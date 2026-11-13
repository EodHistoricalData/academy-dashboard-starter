import { DataTable } from "@/components/DataTable";
import { parseSentimentConfig, type SentimentConfig } from "@/lib/layout";
import type { PanelDef, PanelProps } from "@/lib/panels";
import { type Reading, readings, type Trend } from "@/lib/sentiment";

// A word with an arrow: the direction is read, never only seen.
const TREND: Record<Trend, string> = { up: "↑ up", down: "↓ down", flat: "→ flat" };

/** A tone on its own scale, signed, two places: +0.72, −0.10, 0.00. */
function signed(n: number): string {
  const r = Number(n.toFixed(2));
  return `${r > 0 ? "+" : r < 0 ? "−" : ""}${Math.abs(r).toFixed(2)}`;
}

function toneCell(r: Reading): string {
  if (r.status === "ok") return signed(r.tone!);
  const n = `${r.articles} article${r.articles === 1 ? "" : "s"}`;
  return r.status === "too-few" ? `${n}: too few to read` : "No news";
}

/**
 * News tone for a few symbols: how the news about each reads, against the others. The days
 * are handed in; which symbols, and how many calls that costs, is the layout's business.
 */
function SentimentPanelView({ config, data, onSelect }: PanelProps<SentimentConfig>) {
  const rows = readings(data.sentiment?.bySymbol ?? {}, config.symbols);
  const dated = rows.filter((r) => r.from !== null);
  const from = dated.map((r) => r.from!).sort()[0];
  const to = dated.map((r) => r.to!).sort().at(-1);
  const note = `Tone: article-weighted mean of EODHD’s daily news tone, −1 to 1${
    from && to ? `, ${from} to ${to}` : ""
  }. News reads positive for nearly everything, so the order says more than the number.`;
  return (
    <div className="flex flex-col gap-2">
      <DataTable<Reading>
        columns={[
          { key: "symbol", label: "Symbol", render: (r) => r.symbol },
          { key: "tone", label: "Tone", align: "right", render: toneCell },
          { key: "articles", label: "Articles", align: "right", render: (r) => String(r.articles) },
          {
            key: "trend",
            label: "Trend",
            render: (r) => (r.status === "ok" ? TREND[r.trend] : null),
          },
        ]}
        rows={rows}
        rowKey={(r) => r.symbol}
        // The note under the table says what tone is; read once, not twice.
        caption="News tone by symbol, highest first."
        empty="No symbols on this panel."
        onRowClick={(r) => onSelect(r.symbol)}
        selectedKey={data.selected}
      />
      <p className="text-xs text-zinc-500 dark:text-zinc-400">{note}</p>
    </div>
  );
}

export const SentimentPanel: PanelDef<SentimentConfig> = {
  parse: parseSentimentConfig,
  dataNeeds: (config) => ({ quotes: [], sentiment: config.symbols }),
  Component: SentimentPanelView,
};
