import type { Column } from "@/components/DataTable";
import type { ScreenRow } from "@/lib/screens";

/**
 * The screener's columns. Adding one is an entry here and nothing else: the table, the
 * dash for a missing value and the scrolling are already in DataTable.
 */
export const SCREEN_COLUMNS: Column<ScreenRow>[] = [
  { key: "code", label: "Code", render: (r) => r.code },
  { key: "name", label: "Name", render: (r) => r.name },
  {
    key: "adjusted_close",
    label: "Close",
    align: "right",
    render: (r) => r.adjusted_close.toFixed(2),
  },
  {
    key: "refund_1d_p",
    label: "1d",
    align: "right",
    render: (r) =>
      r.refund_1d_p === null
        ? null
        : `${r.refund_1d_p > 0 ? "+" : r.refund_1d_p < 0 ? "−" : ""}${Math.abs(r.refund_1d_p).toFixed(2)}%`,
    tone: (r) =>
      r.refund_1d_p === null || r.refund_1d_p === 0
        ? null
        : r.refund_1d_p > 0
          ? "up"
          : "down",
  },
  {
    key: "market_capitalization",
    label: "Market cap",
    align: "right",
    render: (r) => r.market_capitalization.toLocaleString("en-US"),
  },
  {
    key: "earnings_share",
    label: "EPS",
    align: "right",
    render: (r) =>
      r.earnings_share === null ? null : r.earnings_share.toFixed(2),
  },
  {
    key: "dividend_yield",
    label: "Yield",
    align: "right",
    // dividend_yield is a FRACTION: 0.0002 is 0.02%. This is the only place that knows.
    render: (r) =>
      r.dividend_yield === null
        ? null
        : `${(r.dividend_yield * 100).toFixed(2)}%`,
  },
  { key: "sector", label: "Sector", render: (r) => r.sector },
];
