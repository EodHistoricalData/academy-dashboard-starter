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
