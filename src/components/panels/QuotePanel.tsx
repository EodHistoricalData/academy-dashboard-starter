import { parseQuoteConfig, type QuoteConfig } from "@/lib/layout";
import type { PanelDef, PanelProps } from "@/lib/panels";
import { isAvailable } from "@/lib/rows";

/**
 * One instrument, large. Which one is the container's decision (it may be the selection);
 * the panel draws the symbol in its config and the quote it is handed.
 */
function QuotePanelView({ config, data }: PanelProps<QuoteConfig>) {
  const fetched = data.quotes.find((q) => q.row.code === config.symbol);
  const row = fetched?.row;
  if (!row || !isAvailable(row)) {
    return (
      <p className="text-zinc-600 dark:text-zinc-400">
        {row ? `No prices for ${config.symbol}.` : config.symbol}
      </p>
    );
  }
  const sign = (n: number) => (n > 0 ? "+" : n < 0 ? "−" : "");
  const tone =
    row.change > 0
      ? "text-emerald-700 dark:text-emerald-400"
      : row.change < 0
        ? "text-red-700 dark:text-red-400"
        : "text-zinc-600 dark:text-zinc-400";
  return (
    <div className="flex flex-col gap-1 tabular-nums">
      <p className="text-sm font-medium">{row.code}</p>
      <p className="text-2xl font-semibold">
        {row.close.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
      </p>
      <p className={`text-sm ${tone}`}>
        {sign(row.change)}
        {Math.abs(row.change).toFixed(2)} ({sign(row.change_p)}
        {Math.abs(row.change_p).toFixed(2)}%)
      </p>
      <p className="text-xs text-zinc-500 dark:text-zinc-400">
        Last trade {new Date(row.timestamp * 1000).toISOString().slice(0, 16).replace("T", " ")} UTC
      </p>
    </div>
  );
}

export const QuotePanel: PanelDef<QuoteConfig> = {
  parse: parseQuoteConfig,
  dataNeeds: (config) => ({ quotes: [config.symbol] }),
  Component: QuotePanelView,
};
