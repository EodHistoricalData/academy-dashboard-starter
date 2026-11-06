// tests/rows.test.ts
import { expect, test } from "vitest";
import { toRows } from "@/lib/rows";

test("an unknown symbol keeps its own row and the others stay", () => {
  const body = [
    { code: "AAPL.US", timestamp: 1793390400, close: 251.32, change: 2.42, change_p: 0.9723 },
    { code: "NOTREAL.US", close: "NA", change: "NA", change_p: "NA", volume: "NA" },
  ];
  const rows = toRows(body);
  expect(rows).toHaveLength(2);
  expect(rows[0]).toMatchObject({ code: "AAPL.US", close: 251.32 });
  expect(rows[1]).toEqual({ code: "NOTREAL.US", status: "unavailable" });
});
