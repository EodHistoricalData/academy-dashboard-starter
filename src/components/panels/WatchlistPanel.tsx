import { DataTable } from "@/components/DataTable";
import { PRICE_COLUMNS } from "@/components/Watchlist";
import { parseWatchlistConfig, type WatchlistConfig } from "@/lib/layout";
import type { PanelDef, PanelProps } from "@/lib/panels";
import type { Row } from "@/lib/rows";

/**
 * The watchlist as a panel: the same columns as the home page, its rows handed in, its
 * notes handed in as text. It asks for nothing, reads no storage and knows no other panel.
 */
function WatchlistPanelView({ config, data, onSelect }: PanelProps<WatchlistConfig>) {
  const bySymbol = new Map(data.quotes.map((q) => [q.row.code, q.row]));
  const rows = config.symbols.flatMap((s) => bySymbol.get(s) ?? []);
  return (
    <DataTable<Row>
      columns={[
        ...PRICE_COLUMNS,
        { key: "note", label: "Note", render: (r) => data.notes[r.code]?.note ?? null },
      ]}
      rows={rows}
      rowKey={(r) => r.code}
      caption="Watchlist: last price and change since the previous close."
      empty="No symbols on this watchlist."
      onRowClick={(r) => onSelect(r.code)}
    />
  );
}

export const WatchlistPanel: PanelDef<WatchlistConfig> = {
  parse: parseWatchlistConfig,
  dataNeeds: (config) => ({ quotes: config.symbols }),
  Component: WatchlistPanelView,
};
