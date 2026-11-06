import { estimateCalls } from "@/lib/cost";
import { eodhdFetch } from "@/lib/eodhd";

/** One row of the watchlist, as the API gives it. */
export type Quote = {
  code: string;
  /** Unix seconds. The age of this number, and the reason the panel below it exists. */
  timestamp: number;
  close: number;
  previousClose: number;
  change: number;
  change_p: number;
  volume: number;
};

/** What the account is allowed to do, read from the account itself rather than assumed. */
export type Account = {
  plan: string;
  used: number | null;
  dailyLimit: number | null;
};

type RawQuote = Partial<Quote> & { code?: string };

/**
 * The one request that fetches the whole watchlist: the first ticker in the path, the
 * rest in `s`. Null for an empty list, which needs no request at all.
 */
export function quotesRequest(
  tickers: string[],
): { path: string; params: Record<string, string> } | null {
  if (tickers.length === 0) return null;
  const [first, ...rest] = tickers;
  const params: Record<string, string> = {};
  if (rest.length > 0) params.s = rest.join(",");
  return { path: `real-time/${first}`, params };
}

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

/**
 * Quotes for the whole watchlist in ONE request — which is still one call per ticker.
 *
 * The endpoint takes the first ticker in the path and the rest in `s`, and — this is the
 * trap — it answers with a bare object for a single ticker and an array when `s` is
 * present. Code that assumes an array works with two tickers on the list and breaks the
 * day someone trims it to one.
 *
 * "NA" comes back in the numeric fields when a market has never traded that symbol, so
 * every field is checked rather than trusted.
 */
export async function quotes(tickers: string[]): Promise<Quote[] | null> {
  const req = quotesRequest(tickers);
  if (req === null) return [];

  try {
    const res = await eodhdFetch(req.path, req.params);
    if (!res.ok) return null;

    const body: unknown = await res.json();
    const rows: RawQuote[] = Array.isArray(body) ? body : [body as RawQuote];
    return rows.filter(isQuote);
  } catch {
    return null;
  }
}

function isQuote(row: RawQuote): row is Quote {
  return (
    typeof row.code === "string" &&
    typeof row.close === "number" &&
    typeof row.change === "number" &&
    typeof row.change_p === "number" &&
    typeof row.timestamp === "number"
  );
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
export function ageMinutes(rows: Quote[], now: number = Date.now()): number | null {
  if (rows.length === 0) return null;
  const newest = Math.max(...rows.map((r) => r.timestamp));
  if (!Number.isFinite(newest)) return null;
  return Math.max(0, Math.round((now - newest * 1000) / 60_000));
}
