/**
 * What a request costs, in API calls.
 *
 * A request is not a call. Calls are the currency your daily quota is counted in, and
 * different endpoints charge different amounts for one request. The free plan has 20 calls
 * a day, so a single fundamentals request is half of it.
 *
 * Measured against a live account, not copied from a pricing page. Keyed by the endpoint:
 * the first segment of the path after /api/ (the "eod" of eod/AAPL.US). Look a new endpoint
 * up before you fetch it in a loop, and add it here.
 */
export const CALL_COST: Readonly<Record<string, number>> = {
  // Free: your plan and today's count. Its answer also carries your e-mail address, which
  // is why the proxy does not forward it — /api/usage reads it on the server instead.
  user: 0,

  // One call per request, however many rows come back: ten years of daily bars cost the
  // same as one day.
  eod: 1,
  div: 1,
  splits: 1,
  "exchange-symbol-list": 1,
  search: 1,

  // One call PER SYMBOL. Ten tickers in one request are ten calls. See estimateCalls.
  "real-time": 1,

  screener: 5,
  news: 5,
  technical: 5,
  intraday: 5,

  fundamentals: 10,
  // US options live on the marketplace, under mp/unicornbay/options/...
  "mp/unicornbay/options": 10,
};

/** Endpoints that charge their price once for every symbol in the request. */
const PER_SYMBOL = new Set(["real-time"]);

/**
 * How many calls one request to `path` with these query parameters will spend, or null
 * when the endpoint is not in the table above.
 *
 *   estimateCalls("eod/AAPL.US", {})                          -> 1
 *   estimateCalls("real-time/AAPL.US", { s: "MSFT.US,NVDA.US" }) -> 3
 *   estimateCalls("real-time", { s: "A,B,C" })                -> 3
 *
 * For real-time, the symbol in the path counts as well as every symbol in `s`: that is how
 * EODHD bills it, and how src/lib/quotes.ts asks — the first ticker in the path, the rest
 * in `s`.
 *
 * Null is "look it up", not zero. A guess written as a number is the kind that empties a
 * free quota by lunchtime.
 */
export function estimateCalls(
  path: string,
  params: Record<string, string> = {},
): number | null {
  const segments = path.replace(/^\/+/, "").split("/").filter(Boolean);
  const endpoint = endpointOf(segments);
  if (endpoint === null) return null;

  const cost = CALL_COST[endpoint];
  if (!PER_SYMBOL.has(endpoint)) return cost;

  const inPath = segments.length > 1 ? 1 : 0;
  const inQuery = (params.s ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean).length;
  return cost * (inPath + inQuery);
}

/** The longest key in CALL_COST that the path starts with, segment by segment. */
function endpointOf(segments: string[]): string | null {
  for (let n = segments.length; n > 0; n--) {
    const candidate = segments.slice(0, n).join("/");
    if (Object.hasOwn(CALL_COST, candidate)) return candidate;
  }
  return null;
}
