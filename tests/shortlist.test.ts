import { describe, expect, it } from "vitest";
import { parseShortlist, withPick, withoutPick } from "@/lib/shortlist";

describe("the shortlist", () => {
  it("refuses a name without a reason", () => {
    expect(() => withPick({}, "NVDA", "   ", "2026-11-06")).toThrow(/reason/);
  });

  it("keeps each name with its sentence, keyed by code", () => {
    const list = withPick({}, "NVDA", "Came up on size. Watching the margin.", "2026-11-06");
    expect(list).toEqual({
      NVDA: { code: "NVDA", note: "Came up on size. Watching the margin.", addedAt: "2026-11-06" },
    });
    expect(withoutPick(list, "NVDA")).toEqual({});
  });

  it("reads half a write as an empty shortlist, and drops entries with no reason", () => {
    expect(parseShortlist('{"NVDA":{"code":"NV')).toEqual({});
    expect(parseShortlist('{"NVDA":{"code":"NVDA","note":""}}')).toEqual({});
  });
});
