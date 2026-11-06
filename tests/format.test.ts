import { expect, test } from "vitest";
import { asPercent, cell, compact, signedPercent } from "@/lib/format";
import { SCREEN_COLUMNS } from "@/lib/screen-columns";
import type { ScreenRow } from "@/lib/screens";

// Every expected value below was worked out by hand from the raw field, not copied from
// what the code printed.

test("a yield of 0.0002 renders as 0.02 per cent", () => {
  expect(asPercent(0.0002)).toBe("0.02%");
});

test("a missing dividend yield is a dash, not a zero", () => {
  expect(cell(undefined)).toBe("—");
  expect(cell(null)).toBe("—");
  const yieldColumn = SCREEN_COLUMNS.find((c) => c.key === "dividend_yield")!;
  expect(cell(yieldColumn.render({ dividend_yield: null } as ScreenRow))).toBe("—");
});

test("a market cap is written in a unit a person can hold in their head", () => {
  expect(compact(5049593888768)).toBe("5.05T");
  expect(compact(851000000000)).toBe("851.00B");
});

test("a float with a binary tail is rounded at the column", () => {
  expect(signedPercent(0.98999999999995)).toBe("+0.99%");
  expect(signedPercent(-2.91)).toBe("−2.91%");
});

test("the close carries its currency on every row", () => {
  const close = SCREEN_COLUMNS.find((c) => c.key === "adjusted_close")!;
  expect(close.render({ adjusted_close: 186.75, currency_symbol: "$" } as ScreenRow)).toBe(
    "$186.75",
  );
});
