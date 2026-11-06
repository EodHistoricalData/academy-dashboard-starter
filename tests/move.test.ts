import { describe, expect, it, vi } from "vitest";
import { eodhdFetch } from "@/lib/eodhd";
import { sortByMove } from "@/lib/move";
import type { Quote } from "@/lib/quotes";

vi.mock("@/lib/eodhd", () => ({ eodhdFetch: vi.fn() }));

const q = (code: string, change_p: number): Quote => ({
  code, change_p, change: 0, close: 1, previousClose: 1, volume: 0, timestamp: 0,
});

const codes = (rows: Quote[]) => rows.map((r) => r.code);

describe("sortByMove", () => {
  it("puts the biggest move first, down or up", () => {
    expect(sortByMove([q("A", 2), q("B", -3)]).map((r) => r.code)).toEqual(["B", "A"]);
  });

  it("keeps watchlist order for rows that moved by the same amount", () => {
    expect(codes(sortByMove([q("A", 3), q("B", -3)]))).toEqual(["A", "B"]);
    expect(codes(sortByMove([q("B", -3), q("A", 3)]))).toEqual(["B", "A"]);
  });

  it("leaves the list passed in unchanged", () => {
    const rows = [q("A", 1), q("B", -5), q("C", 2)];
    sortByMove(rows);
    expect(codes(rows)).toEqual(["A", "B", "C"]);
  });

  it("gives an empty list for an empty list", () => {
    expect(sortByMove([])).toEqual([]);
  });

  it("makes no request, so a page load costs what it did", () => {
    sortByMove([q("A", 1), q("B", -2)]);
    expect(eodhdFetch).not.toHaveBeenCalled();
  });
});
