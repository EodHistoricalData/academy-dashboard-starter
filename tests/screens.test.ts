import { readFileSync } from "node:fs";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  MY_SCREEN,
  screen,
  screenCalls,
  screenErrors,
  screenRequest,
  toScreenRows,
} from "@/lib/screens";

function upstream(status: number, body: unknown) {
  const fetchMock = vi.fn(async (input: string | URL | Request) => {
    void input;
    return Response.json(body, { status });
  });
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

beforeEach(() => {
  vi.stubEnv("EODHD_API_KEY", "test-key-not-a-real-one");
  vi.stubEnv("EODHD_MOCK", "");
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe("the screen request", () => {
  it("sends the filters as JSON triples, with sort and limit", () => {
    const { path, params } = screenRequest(MY_SCREEN);
    expect(path).toBe("screener");
    expect(JSON.parse(params.filters)).toEqual([
      ["market_capitalization", ">", 10000000000],
      ["earnings_share", ">", 0],
      ["exchange", "=", "us"],
    ]);
    expect(params.sort).toBe("market_capitalization.desc");
    expect(params.limit).toBe("20");
  });

  it("costs 5 calls however many rows it asks for", () => {
    expect(screenCalls(MY_SCREEN)).toBe(5);
    expect(screenCalls({ ...MY_SCREEN, limit: 100 })).toBe(5);
  });
});

describe("the screen response", () => {
  it("reads the rows from under data, not from the object", () => {
    const rows = toScreenRows({
      data: [
        {
          code: "NVDA",
          name: "NVIDIA Corporation",
          last_day_data_date: "2026-08-24",
          adjusted_close: 208.48,
          refund_1d_p: -2.91,
          market_capitalization: 5049593888768,
          earnings_share: 6.34,
          dividend_yield: 0.0002,
          sector: "Technology",
        },
      ],
    });
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ code: "NVDA", dividend_yield: 0.0002 });
    expect(toScreenRows([{ code: "NVDA" }])).toEqual([]);
  });

  it("keeps a missing yield as null, not zero", () => {
    const [row] = toScreenRows({
      data: [
        {
          code: "BRK-B",
          name: "Berkshire Hathaway Inc",
          last_day_data_date: "2026-10-30",
          adjusted_close: 489.75,
          market_capitalization: 1056000000000,
        },
      ],
    });
    expect(row.dividend_yield).toBeNull();
    expect(row.earnings_share).toBeNull();
  });

  it("names the filter the API refused, from its errors envelope", async () => {
    upstream(422, {
      errors: { "filters.0.field": ["The selected filters.0.field is invalid."] },
    });
    expect(await screen(MY_SCREEN)).toEqual({
      invalid: ["Filter 1, field: The selected filters.0.field is invalid."],
    });
  });

  it("reads the plain message envelope too", () => {
    expect(screenErrors({ message: "Bad request" })).toEqual(["Bad request"]);
    expect(screenErrors("not json")).toEqual([]);
  });

  it("reports a spent day as a failure, not as an empty screen", async () => {
    upstream(402, { message: "limit" });
    expect(await screen(MY_SCREEN)).toEqual({ failure: { kind: "quota" } });
  });

  it("answers from the fixture in mock mode, without the network", async () => {
    vi.stubEnv("EODHD_MOCK", "1");
    vi.stubEnv("EODHD_API_KEY", "");
    const fetchMock = upstream(500, {});
    const result = await screen(MY_SCREEN);
    const fixture = JSON.parse(readFileSync("fixtures/screener.json", "utf8"));
    expect("rows" in result && result.rows.length).toBe(fixture.data.length);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
