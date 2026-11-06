import { describe, expect, it } from "vitest";
import { ageMinutes, type Quote } from "@/lib/quotes";

const at = (timestamp: number) => ({ timestamp }) as Quote;
const now = Date.UTC(2026, 0, 2, 12, 0); // a fixed clock, not the real one

describe("ageMinutes", () => {
  it("is measured from the newest row", () => {
    expect(ageMinutes([at(now / 1000 - 600), at(now / 1000 - 60)], now)).toBe(1);
  });
  it("is null for no rows", () => {
    expect(ageMinutes([], now)).toBeNull();
  });
  it("never goes below zero", () => {
    expect(ageMinutes([at(now / 1000 + 300)], now)).toBe(0);
  });
});
