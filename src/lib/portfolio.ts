import { isTicker } from "@/lib/added";

/**
 * A portfolio from its trades: what is held, what it cost, what it is worth, and how it
 * moved today. Money is where a wrong number does the most harm and looks the most sure of
 * itself, so every rule here is one that a real portfolio broke, and each has a test.
 *
 * Ported from EodHistoricalData/eodhd-portfolio-tracker, vendor/calculations.js (MIT, the
 * same holder as this repo). Not ported, on purpose:
 *   - realised P&L: what a sale made is a ledger of its own;
 *   - dividends: the position's value is its shares at today's price;
 *   - splits: a split would rescale every open lot (the original has a trade type for it);
 *   - other currencies: see parseTrades.
 */

export type Trade = {
  id: string;
  symbol: string;
  side: "buy" | "sell";
  /** YYYY-MM-DD. */
  date: string;
  quantity: number;
  price: number;
  /** Paid on top of quantity × price: commission, stamp duty. */
  fees: number;
};

/** Shares bought together and not yet sold, with their share of the fees. */
export type Lot = { quantity: number; price: number; feePerShare: number; date: string };

export const MAX_TRADES = 200;

/**
 * The largest numbers a trade may carry: a trillion shares, and a quadrillion in money on any
 * one trade. Above them a book's sums can reach Infinity, and Infinity less a cost is NaN.
 *
 * Ported from EodHistoricalData/eodhd-portfolio-tracker, vendor/calculations.js (MIT),
 * QUANTITY_MAX, TRADE_VALUE_MAX and amountProblem.
 */
export const QUANTITY_MAX = 1e12;
export const TRADE_VALUE_MAX = 1e15;

// A sale of what is held, to the last share, is not an oversell because of 0.1 + 0.2.
const EPS = 1e-9;

/** Date order; on the same day what was bought comes before what was sold. */
function byDate(a: Trade, b: Trade): number {
  if (a.date !== b.date) return a.date < b.date ? -1 : 1;
  return (a.side === "buy" ? 0 : 1) - (b.side === "buy" ? 0 : 1);
}

/**
 * The trades, or why not. A stored list is input like any other, and it is refused rather
 * than repaired: a repaired trade is a trade nobody made.
 *
 * One currency: the symbol must end in .US. A quote carries no currency, and adding a pence
 * price to a dollar price gives a wrong number, not a missing one. The original converts
 * through FX pairs and divides pence by 100; that is out of scope here.
 *
 * No sale may sell more than is held at its date, checked on every date and not only the
 * last: the original refuses it at entry (calculations.js, findShortfall).
 */
export function checkTrades(raw: unknown): { trades: Trade[] } | { error: string } {
  if (!Array.isArray(raw)) return { error: "Trades must be a list." };
  if (raw.length > MAX_TRADES) return { error: `At most ${MAX_TRADES} trades.` };

  const trades: Trade[] = [];
  const ids = new Set<string>();
  for (const [i, item] of raw.entries()) {
    const why = tradeProblem(item);
    if (why !== null) return { error: `Trade ${i + 1}: ${why}` };
    const t = item as Trade;
    if (ids.has(t.id)) return { error: `Trade ${i + 1}: the id ${t.id} is used twice.` };
    ids.add(t.id);
    trades.push({ ...t });
  }

  const held = new Map<string, number>();
  for (const t of [...trades].sort(byDate)) {
    const before = held.get(t.symbol) ?? 0;
    if (t.side === "sell" && t.quantity > before + EPS) {
      return {
        error: `${t.date}: selling ${t.quantity} ${t.symbol}, but only ${shares(before)} held then.`,
      };
    }
    held.set(t.symbol, t.side === "buy" ? before + t.quantity : before - t.quantity);
  }
  return { trades };
}

export function parseTrades(raw: unknown): Trade[] | null {
  const checked = checkTrades(raw);
  return "trades" in checked ? checked.trades : null;
}

/** What is wrong with one trade on its own, in a sentence, or null. */
export function tradeProblem(item: unknown): string | null {
  if (item === null || typeof item !== "object") return "it is not a trade.";
  const t = item as Record<string, unknown>;
  const positive = (v: unknown) => typeof v === "number" && Number.isFinite(v) && v > 0;
  if (typeof t.id !== "string" || t.id === "") return "it has no id.";
  if (!isTicker(t.symbol) || !t.symbol.endsWith(".US")) {
    return `${String(t.symbol)} is not a US listing (SYMBOL.US); this portfolio holds one currency.`;
  }
  if (t.side !== "buy" && t.side !== "sell") return "the side must be buy or sell.";
  if (!isDate(t.date)) return `${String(t.date)} is not a date (YYYY-MM-DD).`;
  if (!positive(t.quantity)) return "the quantity must be a number above 0.";
  if (!positive(t.price)) return "the price must be a number above 0.";
  if (!(typeof t.fees === "number" && Number.isFinite(t.fees) && t.fees >= 0)) {
    return "the fees must be 0 or more.";
  }
  const [quantity, price, fees] = [t.quantity as number, t.price as number, t.fees];
  const big = (n: number) => n.toLocaleString("en-US");
  if (fees > TRADE_VALUE_MAX) return `the fees can’t be more than ${big(TRADE_VALUE_MAX)}.`;
  if (quantity > QUANTITY_MAX) return `the quantity can’t be more than ${big(QUANTITY_MAX)}.`;
  if (price > TRADE_VALUE_MAX || quantity * price > TRADE_VALUE_MAX) {
    return `the total (quantity × price) can’t be more than ${big(TRADE_VALUE_MAX)}.`;
  }
  return null;
}

/** A calendar date that exists: 2026-02-30 has the shape and is not one. */
function isDate(v: unknown): v is string {
  if (typeof v !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(v)) return false;
  const d = new Date(`${v}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === v;
}

const shares = (n: number) => String(Number(n.toFixed(6)));

/**
 * What is still held, per symbol, lot by lot: first in, first out. Sorted by date, buys
 * before sells on the same day; a buy adds a lot carrying its fees per share, a sale takes
 * shares from the oldest lot first, so the fees of shares sold leave with them.
 *
 * Ported from EodHistoricalData/eodhd-portfolio-tracker, vendor/calculations.js (MIT),
 * getOpenLots and byDate. Changed on purpose: grouped by symbol here rather than called per
 * holding; no split rescaling (splits are not ported); a lot is closed when what is left is
 * below 1e-9, not exactly 0, so 0.1 + 0.2 shares sold of 0.3 leave nothing behind.
 */
export function openLots(trades: Trade[]): Map<string, Lot[]> {
  const lots = new Map<string, Lot[]>();
  for (const t of [...trades].sort(byDate)) {
    const open = lots.get(t.symbol) ?? [];
    lots.set(t.symbol, open);
    if (t.side === "buy") {
      const feePerShare = t.fees / t.quantity;
      open.push({ quantity: t.quantity, price: t.price, feePerShare, date: t.date });
      continue;
    }
    let left = t.quantity;
    while (left > EPS && open.length > 0) {
      const lot = open[0];
      const take = Math.min(left, lot.quantity);
      lot.quantity -= take;
      left -= take;
      if (lot.quantity <= EPS) open.shift();
    }
  }
  return lots;
}

/**
 * One position's move today. Shares held since before the quote's day moved from the
 * previous close; shares bought on that day moved from what was paid for them, fees
 * included, because yesterday they were not held. Counted from the previous close, a
 * position bought today at today's price would show a day's gain beside a total of zero.
 *
 * Ported from EodHistoricalData/eodhd-portfolio-tracker, vendor/calculations.js (MIT),
 * dayChangeValue. Changed on purpose: no FX rate (one currency); `boughtToday.cost`
 * includes fees, so on the day of purchase the day's move and the unrealised P&L agree to
 * the cent.
 */
export function dayChange(
  price: number,
  previousClose: number,
  quantity: number,
  boughtToday: { quantity: number; cost: number },
): number {
  let change = (price - previousClose) * quantity;
  const bought = Math.min(boughtToday.quantity, quantity);
  if (bought > 0) {
    const paidPerShare = boughtToday.cost / boughtToday.quantity;
    change += (previousClose - paidPerShare) * bought;
  }
  return change;
}

/** What positions() reads from a quote; an unavailable row has none of it. */
export type PriceQuote = {
  code: string;
  close?: number | null;
  previousClose?: number | null;
  /** Unix seconds. */
  timestamp?: number | null;
};

export type Position = {
  symbol: string;
  quantity: number;
  /** What the open shares cost, fees included. */
  cost: number;
  avgCost: number;
  /** Null: no price, so no value, no P&L and no weight. Never valued at zero. */
  price: number | null;
  value: number | null;
  unrealised: number | null;
  /** Null without a price, the close before it, and the time of the quote. */
  day: number | null;
  /** Of the summed value of the priced positions. */
  weight: number | null;
};

export type Book = {
  positions: Position[];
  /** Over the priced positions only. `day` over those whose day is known; null if none. */
  totals: { value: number; cost: number; unrealised: number; day: number | null };
  /** Positions left out of the totals for want of a price. */
  unpriced: number;
};

// A price is a number above zero: a quote of 0 or "NA" is no price, not a worthless share.
const asPrice = (v: unknown) =>
  typeof v === "number" && Number.isFinite(v) && v > 0 ? v : null;

/**
 * Every symbol with shares still held: its quantity and cost from the open lots, and its
 * price, value and day from the quote. The price is the quote's close. A quote without one
 * arrives already marked unavailable (toRows in src/lib/rows.ts), so a position without a
 * close is unpriced: kept on the list with its quantity and cost, left out of the totals,
 * and counted, rather than valued at zero, which would book it as a 100% loss.
 */
export function positions(trades: Trade[], quotes: PriceQuote[]): Book {
  const bySymbol = new Map(quotes.map((q) => [q.code, q]));
  const rows: Position[] = [];
  for (const [symbol, lots] of openLots(trades)) {
    const quantity = lots.reduce((s, l) => s + l.quantity, 0);
    if (quantity <= EPS) continue;
    const cost = lots.reduce((s, l) => s + l.quantity * (l.price + l.feePerShare), 0);
    const q = bySymbol.get(symbol);
    const price = asPrice(q?.close);
    const previousClose = asPrice(q?.previousClose);
    const value = price === null ? null : price * quantity;

    // The day the quote is from, in UTC: lots dated on or after it were bought "today".
    const ts = q?.timestamp;
    const quoteDay =
      typeof ts === "number" && Number.isFinite(ts)
        ? new Date(ts * 1000).toISOString().slice(0, 10)
        : null;
    let day: number | null = null;
    if (price !== null && previousClose !== null && quoteDay !== null) {
      const today = lots.filter((l) => l.date >= quoteDay);
      day = dayChange(price, previousClose, quantity, {
        quantity: today.reduce((s, l) => s + l.quantity, 0),
        cost: today.reduce((s, l) => s + l.quantity * (l.price + l.feePerShare), 0),
      });
    }

    rows.push({
      symbol,
      quantity,
      cost,
      avgCost: cost / quantity,
      price,
      value,
      unrealised: value === null ? null : value - cost,
      day,
      weight: null,
    });
  }

  const priced = rows.filter((p) => p.value !== null);
  const total = priced.reduce((s, p) => s + p.value!, 0);
  for (const p of priced) p.weight = total > 0 ? p.value! / total : null;
  const days = priced.flatMap((p) => (p.day === null ? [] : [p.day]));
  const cost = priced.reduce((s, p) => s + p.cost, 0);
  return {
    positions: rows,
    totals: {
      value: total,
      cost,
      unrealised: total - cost,
      day: days.length > 0 ? days.reduce((s, d) => s + d, 0) : null,
    },
    unpriced: rows.length - priced.length,
  };
}
