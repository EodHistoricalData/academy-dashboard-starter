import { eodhdFetch, hasKey, isMock } from "@/lib/eodhd";
import { type Failure, failureFromStatus } from "@/lib/failure";

/**
 * The transport every market request shares, whatever product it is for: check the key
 * is there before asking, ask through eodhdFetch (which signs it on the server and gives
 * up after 15 seconds), read the status before the body, and narrow the body to a known
 * shape at the boundary.
 *
 * Nothing here knows what a watchlist or a screen is. src/lib/quotes.ts and
 * src/lib/screens.ts turn what comes back into their own rows.
 */
export type MarketResult<T> =
  | { ok: true; value: T }
  /** `body` is the answer when there was one, parsed if it was JSON and as text if not:
   *  some endpoints say what went wrong in it (the screener names the filter it refused,
   *  /eod says "Ticker Not Found."). */
  | { ok: false; failure: Failure; body: unknown };

export async function marketGet<T>(
  path: string,
  params: Record<string, string>,
  narrow: (body: unknown) => T,
): Promise<MarketResult<T>> {
  // The API answers a missing key and a wrong one with the same 401, so only we can tell
  // them apart, and only by looking before we ask.
  if (!isMock() && !hasKey()) {
    return { ok: false, failure: { kind: "no-key" }, body: null };
  }

  try {
    const res = await eodhdFetch(path, params);
    if (!res.ok) {
      return {
        ok: false,
        failure: failureFromStatus(res.status, res.headers.get("retry-after")),
        body: await readBody(res),
      };
    }
    return { ok: true, value: narrow(await res.json()) };
  } catch {
    // Network error, the timeout in eodhdFetch, or a body that is not JSON.
    return {
      ok: false,
      failure: { kind: "unreachable", status: null },
      body: null,
    };
  }
}

/**
 * An error body as data: parsed JSON when it is JSON, the text when it is not. Some answers
 * are plain text — an unknown ticker on /eod is `Ticker Not Found.` with a 404 — and
 * calling res.json() on those throws before anyone learns what was wrong.
 */
async function readBody(res: Response): Promise<unknown> {
  const text = await res.text().catch(() => "");
  try {
    return JSON.parse(text);
  } catch {
    return text.trim() || null;
  }
}

