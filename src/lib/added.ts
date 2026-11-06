/**
 * Tickers added to the watchlist from the screen.
 *
 * The watchlist's own list is a file in the repo (src/lib/watchlist.ts), which a button on
 * a page cannot edit. So names promoted from the screen live beside it, in a cookie the
 * server reads when it renders the watchlist: the quotes are still fetched on the server,
 * and nothing about the key changes. Two homes for one list is the awkward part, and
 * PLAN.md says so.
 *
 * A cookie can be edited by anyone holding the browser, and these values go into a
 * request made with the key, so each one is checked against the ticker shape on the way
 * in. Each added name is one more call on every watchlist load, hence the cap.
 */
export const ADDED_COOKIE = "watchlist-added-v1";
export const MAX_ADDED = 10;

const TICKER = /^[A-Z0-9][A-Z0-9-]{0,19}\.[A-Z]{2,10}$/;

export function isTicker(value: unknown): value is string {
  return typeof value === "string" && TICKER.test(value);
}

/** A screener row's code has no exchange suffix; the watchlist's tickers do. */
export function toTicker(row: { code: string; exchange: string | null }): string {
  return `${row.code}.${row.exchange ?? "US"}`;
}

export function parseAdded(raw: string | undefined): string[] {
  let value: unknown;
  try {
    value = JSON.parse(raw ?? "[]");
  } catch {
    return [];
  }
  return Array.isArray(value) ? [...new Set(value.filter(isTicker))].slice(0, MAX_ADDED) : [];
}

export function withAdded(list: string[], ticker: string): string[] {
  if (!isTicker(ticker) || list.includes(ticker) || list.length >= MAX_ADDED) return list;
  return [...list, ticker];
}

export function withoutAdded(list: string[], ticker: string): string[] {
  return list.filter((t) => t !== ticker);
}
