import { DataTable } from "@/components/DataTable";
import { toTicker } from "@/lib/added";
import { parseScreenConfig, type ScreenConfig } from "@/lib/layout";
import type { PanelDef, PanelProps } from "@/lib/panels";
import { SCREEN_COLUMNS } from "@/lib/screen-columns";
import type { ScreenRow } from "@/lib/screen-query";

const COLUMNS = SCREEN_COLUMNS.filter((c) =>
  ["code", "name", "adjusted_close", "refund_1d_p", "market_capitalization"].includes(c.key),
);

/** A saved screen as a panel: the rows that match its filters, handed in. */
function ScreenPanelView({ data, onSelect }: PanelProps<ScreenConfig>) {
  return (
    <DataTable<ScreenRow>
      columns={COLUMNS}
      rows={data.screen?.rows ?? []}
      rowKey={(r) => r.code}
      caption="Companies matching the screen. They match the filters; that is all they are."
      empty="Nothing matches these filters."
      onRowClick={(r) => onSelect(toTicker(r))}
    />
  );
}

export const ScreenPanel: PanelDef<ScreenConfig> = {
  parse: parseScreenConfig,
  dataNeeds: (config) => ({ quotes: [], screen: config }),
  Component: ScreenPanelView,
};
