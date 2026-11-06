import { describe, expect, it } from "vitest";
import { putDocViaRoute } from "@/lib/doc-client";
import { DEFAULT_LAYOUT } from "@/lib/layout";
import { exportLayout, layoutsFrom, resolveLayout } from "@/lib/layouts";

const morning = { ...DEFAULT_LAYOUT, name: "Morning check" };
const earnings = { ...DEFAULT_LAYOUT, name: "Earnings week", panels: DEFAULT_LAYOUT.panels.slice(0, 2) };

describe("resolveLayout", () => {
  it("opens the default for a name it does not have, never an error", () => {
    const saved = { [earnings.name]: earnings };
    expect(resolveLayout(saved, "Earnings week")).toBe(earnings);
    expect(resolveLayout(saved, "made-up")).toBe(DEFAULT_LAYOUT);
    expect(resolveLayout(saved, null)).toBe(DEFAULT_LAYOUT);
    expect(resolveLayout(saved, "__proto__")).toBe(DEFAULT_LAYOUT);
  });
});

describe("layoutsFrom", () => {
  it("checks every panel of every layout again on the way in, keyed by name", () => {
    const stored = {
      "Earnings week": {
        ...earnings,
        panels: [{ ...earnings.panels[0], type: "quote", config: { symbol: "../user", follows: true } }],
      },
    };
    const layouts = layoutsFrom(stored);
    expect(Object.keys(layouts)).toEqual(["Earnings week"]);
    expect(layouts["Earnings week"].panels[0].type).toBe("placeholder");
  });

  it("starts from the default layout when nothing is stored", () => {
    expect(layoutsFrom(null)).toEqual({ [DEFAULT_LAYOUT.name]: DEFAULT_LAYOUT });
  });
});

describe("autosave", () => {
  it("meets a newer version and says so, carrying what the other tab saved", async () => {
    const server = async () =>
      Response.json(
        { error: "Your other tab is ahead", current: { version: 4, payload: { [morning.name]: morning } } },
        { status: 409 },
      );
    const outcome = await putDocViaRoute("layouts", 3, {}, server as typeof fetch);
    expect(outcome).toEqual({ kind: "conflict", current: { version: 4, payload: { [morning.name]: morning } } });
  });

  it("returns the new version when the write lands, and a failure when the store is unreachable", async () => {
    const ok = async () => Response.json({ version: 8 });
    expect(await putDocViaRoute("layouts", 7, {}, ok as typeof fetch)).toEqual({ kind: "saved", version: 8 });
    const down = async () => {
      throw new TypeError("network");
    };
    expect(await putDocViaRoute("layouts", 7, {}, down as typeof fetch)).toEqual({ kind: "failed", status: null });
  });
});

describe("exportLayout", () => {
  it("is one layout as JSON: name, version and panels, nothing else", () => {
    const parsed = JSON.parse(exportLayout({ ...morning, extra: "secret" } as never));
    expect(Object.keys(parsed)).toEqual(["name", "version", "panels"]);
    expect(Object.keys(parsed.panels[0])).toEqual(["id", "type", "title", "config", "position"]);
  });
});
