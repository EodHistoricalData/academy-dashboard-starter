/**
 * One retry policy for every EODHD request the alert makes, by status:
 *
 *   402        the day's calls are spent    stop; nothing works until midnight GMT
 *   429        over the per-minute limit    wait for Retry-After, retry once
 *   403, 404   plan or ticker is wrong      no retry; name the rule; fail
 *   5xx        upstream trouble             two retries, a growing pause, then fail
 *   timeout    no answer in time            the same as a 5xx
 *
 * A retry is another request, and EODHD bills requests, so the policy is also a budget.
 * The pause is a function passed in, so a test can check it without waiting.
 */
export type Sleep = (ms: number) => Promise<void>;

export const sleep: Sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/** Pauses before the first and second retry of a 5xx or a timeout. */
export const SERVER_ERROR_PAUSES_MS = [1_000, 2_000];

/** How long to wait after a 429 that does not say. Capped, so one header cannot stall the job. */
const DEFAULT_RETRY_AFTER_S = 60;
const MAX_RETRY_AFTER_S = 300;

export class FetchError extends Error {
  constructor(
    message: string,
    readonly status: number | "timeout",
  ) {
    super(message);
  }
}

/**
 * Send `request` until it succeeds or the policy says stop. `forWhat` names what the
 * request serves (the rules), so a failure says which rule to fix.
 */
export async function withRetry(
  request: () => Promise<Response>,
  wait: Sleep,
  forWhat: string,
): Promise<Response> {
  let serverRetries = 0;
  let waitedFor429 = false;

  for (;;) {
    let res: Response;
    try {
      res = await request();
    } catch (error) {
      // A timeout or a dropped connection. The error's text can quote the request URL,
      // key included, so it is not passed on.
      if (serverRetries < SERVER_ERROR_PAUSES_MS.length) {
        await wait(SERVER_ERROR_PAUSES_MS[serverRetries++]);
        continue;
      }
      const kind = error instanceof Error && error.name === "AbortError" ? "timeout" : "network error";
      throw new FetchError(`${kind} three times, ${forWhat}.`, "timeout");
    }

    if (res.ok) return res;
    const status = res.status;

    if (status === 402) {
      throw new FetchError(
        "402: today's API calls are spent. Not retried: nothing succeeds until midnight GMT.",
        402,
      );
    }
    if (status === 429 && !waitedFor429) {
      waitedFor429 = true;
      await wait(retryAfterMs(res.headers.get("retry-after")));
      continue;
    }
    if (status >= 500 && serverRetries < SERVER_ERROR_PAUSES_MS.length) {
      await wait(SERVER_ERROR_PAUSES_MS[serverRetries++]);
      continue;
    }

    const why =
      status === 404
        ? " No such ticker: check the symbol. Live, a 404 is still billed."
        : status === 403
          ? " The plan does not cover this data."
          : "";
    throw new FetchError(`${status}, ${forWhat}.${why}`, status);
  }
}

/** Retry-After in seconds, as EODHD sends it; anything else gets the default. */
function retryAfterMs(header: string | null): number {
  const seconds = Number(header);
  const s = Number.isFinite(seconds) && seconds >= 0 ? seconds : DEFAULT_RETRY_AFTER_S;
  return Math.min(s, MAX_RETRY_AFTER_S) * 1_000;
}
