import { estimateCalls } from "@/lib/cost";
import { eodhdFetch } from "@/lib/eodhd";
import type { Failure } from "@/lib/failure";
import { marketGet } from "@/lib/market";
import { quotesRequest } from "@/lib/quote-request";
import { isAvailable, type Row, toRows } from "@/lib/rows";

export { quotesRequest } from "@/lib/quote-request";

/** One row of the watchlist, as the API gives it. */
export type Quote = {
  code: string;
  /** Unix seconds. The age of this number, and the reason the panel below it exists. */
  timestamp: number;
  close: number;
  previousClose: number;
  change: number;
  change_p: number;
  /** Null when the answer carried none, or "NA". */
  volume: number | null;
};

/** What the account is allowed to do, read from the account itself rather than assumed. */
export type Account = {
  plan: string;
  used: number | null;
  dailyLimit: number | null;
};

/**
 * What one load of the page spends, in API calls: one per ticker for the quotes, nothing
 * for the plan read. Worked out from the same request quotes() sends, so the number on the
 * page cannot drift from what the page actually does.
 */
export function pageLoadCalls(tickers: string[]): number {
  const req = quotesRequest(tickers);
  const forQuotes = req ? (estimateCalls(req.path, req.params) ?? 0) : 0;
  return forQuotes + (estimateCalls("user") ?? 0);
}

/** The rows, or the reason there are none. */
export type QuotesResult = { rows: Row[] } | { failure: Failure };

/**
 * Quotes for the whole watchlist in ONE request — which is still one call per ticker.
 *
 * The endpoint takes the first ticker in the path and the rest in `s`, and — this is the
 * trap — it answers with a bare object for a single ticker and an array when `s` is
 * present. Code that assumes an array works with two tickers on the list and breaks the
 * day someone trims it to one.
 *
 * "NA" comes back in the numeric fields when a market has never traded that symbol. That
 * row stays on the list, marked unavailable: see toRows in src/lib/rows.ts.
 *
 * The status is checked before the body is parsed: a 402 and a 401 both arrive with a body,
 * and the status is the only part that says which of them this is.
 */
export async function quotes(tickers: string[]): Promise<QuotesResult> {
  const req = quotesRequest(tickers);
  if (req === null) return { rows: [] };

  const result = await marketGet(req.path, req.params, toRows);
  return result.ok ? { rows: result.value } : { failure: result.failure };
}

/** Plan and today's call count, straight from the account. */
export async function account(): Promise<Account | null> {
  try {
    const res = await eodhdFetch("user", {});
    if (!res.ok) return null;
    const u = (await res.json()) as {
      subscriptionType?: string;
      apiRequests?: number;
      dailyRateLimit?: number;
    };
    return {
      plan: u.subscriptionType ?? "unknown",
      used: typeof u.apiRequests === "number" ? u.apiRequests : null,
      dailyLimit: typeof u.dailyRateLimit === "number" ? u.dailyRateLimit : null,
    };
  } catch {
    return null;
  }
}

/**
 * How old the freshest number on the page is, in minutes.
 *
 * Computed from the quote's own timestamp rather than from the plan name, because the plan
 * name is a claim and the timestamp is the evidence. This is what the freshness panel
 * reports, and it is why that panel is honest instead of a pitch.
 */
export function ageMinutes(rows: Row[], now: number = Date.now()): number | null {
  const priced = rows.filter(isAvailable);
  if (priced.length === 0) return null;
  const newest = Math.max(...priced.map((r) => r.timestamp));
  if (!Number.isFinite(newest)) return null;
  return Math.max(0, Math.round((now - newest * 1000) / 60_000));
}
