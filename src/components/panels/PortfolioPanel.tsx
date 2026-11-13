import { type FormEvent, useState } from "react";
import { type Column, DataTable } from "@/components/DataTable";
import { parsePortfolioConfig, type PortfolioConfig } from "@/lib/layout";
import type { PanelDef, PanelProps } from "@/lib/panels";
import { checkTrades, openLots, positions, type Trade, tradeProblem } from "@/lib/portfolio";

/** A row of the table: a position, or the totals under them. */
type Line = {
  symbol: string;
  quantity: number | null;
  avgCost: number | null;
  price: number | null;
  value: number | null;
  unrealised: number | null;
  day: number | null;
  weight: number | null;
  unpriced: boolean;
};

const money = (n: number | null) =>
  n === null ? null : n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

/** Rounded first, so a loss of a fraction of a cent reads 0.00, not −0.00. */
function signedMoney(n: number | null): string | null {
  if (n === null) return null;
  const r = Number(n.toFixed(2));
  return `${r > 0 ? "+" : r < 0 ? "−" : ""}${money(Math.abs(r))}`;
}

const toneOf = (n: number | null) => {
  const r = n === null ? 0 : Number(n.toFixed(2));
  return r > 0 ? "up" : r < 0 ? "down" : null;
};

const COLUMNS: Column<Line>[] = [
  { key: "symbol", label: "Symbol", render: (r) => r.symbol },
  {
    key: "quantity",
    label: "Qty",
    align: "right",
    render: (r) => (r.quantity === null ? null : String(Number(r.quantity.toFixed(6)))),
  },
  { key: "avgCost", label: "Avg cost", align: "right", render: (r) => money(r.avgCost) },
  {
    key: "price",
    label: "Price",
    align: "right",
    render: (r) => (r.unpriced ? "no price: left out of the totals" : money(r.price)),
  },
  { key: "value", label: "Value", align: "right", render: (r) => money(r.value) },
  {
    key: "unrealised",
    label: "Unrealised",
    align: "right",
    render: (r) => signedMoney(r.unrealised),
    tone: (r) => toneOf(r.unrealised),
  },
  {
    key: "day",
    label: "Today",
    align: "right",
    render: (r) => signedMoney(r.day),
    tone: (r) => toneOf(r.day),
  },
  {
    key: "weight",
    label: "Weight",
    align: "right",
    render: (r) => (r.weight === null ? null : `${(r.weight * 100).toFixed(1)}%`),
  },
];

/**
 * A portfolio from its trades, priced by the quotes handed in: what is held, what it cost,
 * what it is worth and how it moved today. The trades are this panel's config, saved with
 * the layout like a watchlist's symbols; adding one goes out through onConfigChange.
 */
function PortfolioPanelView({ config, data, onSelect, onConfigChange }: PanelProps<PortfolioConfig>) {
  const book = positions(
    config.trades,
    data.quotes.map((q) => q.row),
  );
  const priced = book.positions.length - book.unpriced;
  const total: Line = {
    symbol: "Total",
    quantity: null,
    avgCost: null,
    price: null,
    value: priced > 0 ? book.totals.value : null,
    unrealised: priced > 0 ? book.totals.unrealised : null,
    day: book.totals.day,
    weight: priced > 0 ? 1 : null,
    unpriced: false,
  };
  return (
    <div className="flex flex-col gap-4">
      <DataTable<Line>
        columns={COLUMNS}
        rows={book.positions.map((p) => ({ ...p, unpriced: p.price === null }))}
        rowKey={(r) => r.symbol}
        caption="Portfolio: open positions, cost with fees, value at the last price, and today’s move."
        empty="No open positions. Add a trade below."
        onRowClick={(r) => onSelect(r.symbol)}
        selectedKey={data.selected}
        footer={book.positions.length > 0 ? total : undefined}
      />
      {book.unpriced > 0 && (
        <p className="text-xs text-zinc-500 dark:text-zinc-400">{leftOut(book.unpriced)}</p>
      )}
      <AddTrade
        trades={config.trades}
        onAdd={(trades) => onConfigChange({ ...config, trades })}
      />
    </div>
  );
}

function leftOut(n: number): string {
  const [what, its] = n === 1 ? ["1 position", "its"] : [`${n} positions`, "their"];
  return `${what} left out of the totals: no price came back. The table has ${its} cost; ${its} value is unknown, not zero.`;
}

const INPUT =
  "rounded border border-zinc-300 bg-white px-2 py-1 text-sm text-zinc-900 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100";

const BLANK = { symbol: "", side: "buy", date: "", quantity: "", price: "", fees: "" };

/**
 * A trade, typed in. What is typed is this form's own state until it is added; then the
 * whole new list is checked as the layout will check it, and refused with the reason.
 */
function AddTrade({ trades, onAdd }: { trades: Trade[]; onAdd(next: Trade[]): void }) {
  const [draft, setDraft] = useState(BLANK);
  const [error, setError] = useState<string | null>(null);
  const field = (name: keyof typeof BLANK) => ({
    value: draft[name],
    onChange: (e: { target: { value: string } }) => setDraft({ ...draft, [name]: e.target.value }),
  });

  function submit(e: FormEvent) {
    e.preventDefault();
    // An empty box is not a zero: it fails the check. Fees left empty are none.
    const num = (s: string) => (s.trim() === "" ? Number.NaN : Number(s));
    let id = trades.length + 1;
    while (trades.some((t) => t.id === String(id))) id++;
    const trade = {
      id: String(id),
      symbol: draft.symbol.trim().toUpperCase(),
      side: draft.side,
      date: draft.date,
      quantity: num(draft.quantity),
      price: num(draft.price),
      fees: draft.fees.trim() === "" ? 0 : num(draft.fees),
    };
    const why = tradeProblem(trade);
    const checked = why === null ? checkTrades([...trades, trade]) : { error: why };
    if ("error" in checked) {
      setError(`Not added: ${checked.error}`);
      return;
    }
    setError(null);
    setDraft({ ...draft, quantity: "", price: "", fees: "" });
    onAdd(checked.trades);
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-2 border-t border-zinc-100 pt-3 dark:border-zinc-800">
      <div className="flex flex-wrap items-end gap-2 text-xs text-zinc-600 dark:text-zinc-400">
        <label className="flex flex-col gap-1">
          Symbol
          <input {...field("symbol")} placeholder="AAPL.US" className={`${INPUT} w-24`} />
        </label>
        <label className="flex flex-col gap-1">
          Side
          <select {...field("side")} className={INPUT}>
            <option value="buy">buy</option>
            <option value="sell">sell</option>
          </select>
        </label>
        <label className="flex flex-col gap-1">
          Date
          <input {...field("date")} type="date" className={INPUT} />
        </label>
        <label className="flex flex-col gap-1">
          Quantity
          <input {...field("quantity")} inputMode="decimal" className={`${INPUT} w-20 tabular-nums`} />
        </label>
        <label className="flex flex-col gap-1">
          Price
          <input {...field("price")} inputMode="decimal" className={`${INPUT} w-24 tabular-nums`} />
        </label>
        <label className="flex flex-col gap-1">
          Fees
          <input {...field("fees")} inputMode="decimal" placeholder="0" className={`${INPUT} w-16 tabular-nums`} />
        </label>
        <button
          type="submit"
          className="rounded border border-zinc-300 px-2.5 py-1 text-sm text-zinc-900 dark:border-zinc-700 dark:text-zinc-100"
        >
          Add trade
        </button>
      </div>
      {error && (
        <p role="alert" className="text-sm text-red-700 dark:text-red-400">
          {error}
        </p>
      )}
    </form>
  );
}

export const PortfolioPanel: PanelDef<PortfolioConfig> = {
  parse: parsePortfolioConfig,
  // The symbols still held, so they union with every other panel's quotes.
  dataNeeds: (config) => ({
    quotes: [...openLots(config.trades)].flatMap(([symbol, lots]) => (lots.length > 0 ? [symbol] : [])),
  }),
  Component: PortfolioPanelView,
};
