import { describe, expect, it } from "vitest";
import { ageSeconds, describeAge, medianGap } from "@/lib/age";
import { medianOf } from "../scripts/sample-interval.mjs";

describe("ageSeconds", () => {
  it("is now minus the response's own timestamp, in Unix seconds", () => {
    // 1787689680 is 2026-08-25 20:28:00 UTC; gmtoffset never enters.
    expect(ageSeconds(1787689680, Date.UTC(2026, 7, 25, 20, 30, 0))).toBe(120);
  });

  it("is never negative, when a clock runs a little ahead", () => {
    expect(ageSeconds(1787689680, 1787689680 * 1000 - 5000)).toBe(0);
  });
});

describe("medianGap", () => {
  it("treats a repeated timestamp as the same trade seen again, not a gap of zero", () => {
    // Sampled once a minute: the price changed at 0, 180 and 300 seconds.
    expect(medianGap([1000, 1000, 1000, 1180, 1180, 1300])).toBe(150);
  });

  it("takes the middle of an odd count, and nothing from one distinct value", () => {
    expect(medianGap([0, 60, 180, 600])).toBe(120);
    expect(medianGap([1000, 1000, 1000])).toBeNull();
  });
});

describe("describeAge", () => {
  it("says the age in the unit a person reads", () => {
    expect(describeAge(30)).toBe("30 s old");
    expect(describeAge(47 * 60)).toBe("47 min old");
    expect(describeAge(5 * 3600)).toBe("5 h old");
    expect(describeAge(7 * 86400)).toBe("7 days old");
  });
});

describe("scripts/sample-interval.mjs", () => {
  it("takes the median the same way as medianGap", () => {
    for (const t of [[1000, 1000, 1180, 1180, 1300], [0, 60, 180, 600], [5, 5], []]) {
      expect(medianOf(t)).toBe(medianGap(t));
    }
  });
});
