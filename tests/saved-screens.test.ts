import { describe, expect, it } from "vitest";
import {
  parseScreens,
  screenHref,
  type SavedScreen,
  withoutScreen,
  withScreen,
} from "@/lib/saved-screens";

const big: SavedScreen = {
  name: "Big and profitable",
  filters: [
    { field: "market_capitalization", op: ">", value: 10000000000 },
    { field: "earnings_share", op: ">", value: 0 },
  ],
  sort: "market_capitalization.desc",
  createdAt: "2026-11-06T07:00:00.000Z",
};

describe("parseScreens", () => {
  it("returns nothing for half a write instead of throwing", () => {
    expect(parseScreens('{"Big and profitable":{"name":"Big')).toEqual({});
    expect(parseScreens(null)).toEqual({});
    expect(parseScreens("[]")).toEqual({});
  });

  it("returns screens keyed by name", () => {
    const raw = JSON.stringify({ [big.name]: big });
    expect(parseScreens(raw)).toEqual({ [big.name]: big });
  });

  it("drops a stored screen whose filters are not on the list", () => {
    const tampered = {
      ...big,
      filters: [{ field: "password", op: "=", value: "x" }],
    };
    expect(parseScreens(JSON.stringify({ [big.name]: tampered }))).toEqual({});
  });
});

describe("saving", () => {
  it("replaces a screen saved under the same name, keeps the others", () => {
    const other = { ...big, name: "Yield" };
    const screens = withScreen(withScreen({}, big), other);
    const renamed = withScreen(screens, { ...big, sort: "dividend_yield.desc" });
    expect(Object.keys(renamed)).toEqual([big.name, "Yield"]);
    expect(renamed[big.name].sort).toBe("dividend_yield.desc");
    expect(withoutScreen(renamed, "Yield")).toEqual({
      [big.name]: renamed[big.name],
    });
  });

  it("reopens as an address, so the market is asked again", () => {
    expect(screenHref(big)).toBe(
      "/screen?f=market_capitalization%3Agt%3A10000000000%2Cearnings_share%3Agt%3A0&sort=market_capitalization.desc",
    );
  });
});
