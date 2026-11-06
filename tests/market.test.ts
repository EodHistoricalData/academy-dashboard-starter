import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { marketGet } from "@/lib/market";
import { quotes } from "@/lib/quotes";
import { alertText, firedAlerts, RULES } from "@/lib/rules";
import { WATCHLIST } from "@/lib/watchlist";

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe("marketGet", () => {
  beforeEach(() => {
    vi.stubEnv("EODHD_API_KEY", "test-key-not-a-real-one");
    vi.stubEnv("EODHD_MOCK", "");
  });

  it("narrows a good answer and keeps the body of a bad one", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => Response.json({ errors: { x: ["y"] } }, { status: 422 })),
    );
    const bad = await marketGet("screener", {}, () => "narrowed");
    expect(bad).toEqual({
      ok: false,
      failure: { kind: "unreachable", status: 422 },
      body: { errors: { x: ["y"] } },
    });

    vi.stubGlobal("fetch", vi.fn(async () => Response.json([1, 2])));
    const good = await marketGet("eod/AAPL.US", {}, (b) => (b as number[]).length);
    expect(good).toEqual({ ok: true, value: 2 });
  });
});

// What the watchlist screenshot shows on the fixtures, pinned before the table is rebuilt:
// the uncovered listing keeps its row, and the one rule fires with its sentence.
describe("the watchlist on the fixtures", () => {
  beforeEach(() => {
    vi.stubEnv("EODHD_MOCK", "1");
    vi.stubEnv("EODHD_API_KEY", "");
  });

  it("keeps 005930.KO as an unavailable row, in list order", async () => {
    const result = await quotes(WATCHLIST);
    if (!("rows" in result)) throw new Error("expected rows");
    expect(result.rows.map((r) => r.code)).toEqual(WATCHLIST);
    expect(result.rows.at(-1)).toEqual({ code: "005930.KO", status: "unavailable" });
  });

  it("fires the MSFT rule with the sentence on the page", async () => {
    const result = await quotes(WATCHLIST);
    if (!("rows" in result)) throw new Error("expected rows");
    const fired = firedAlerts(RULES, result.rows);
    expect(fired.map(({ rule, quote }) => alertText(rule, quote))).toEqual([
      "MSFT.US down 0.67% — your rule was −0.5%",
    ]);
  });
});
