/**
 * Why the watchlist came back without data.
 *
 * A market tool fails in four ways, and each has a different fix: no key, a key the API
 * rejected, a day's calls spent, and a ticker that does not exist. Two are not here: a
 * missing key is caught before anything is sent (the page checks the variable), and a bad
 * ticker is not a failure of the list, it fails its own row. The rest stop the whole
 * request, and the page names which one it was rather than saying "something went wrong"
 * over all of them.
 *
 * 429 is kept apart from 402 on purpose. Both are limits, but a busy minute clears by
 * itself and a spent day does not, so waiting is right for one and useless for the other.
 */
export type Failure =
  /** 401: missing, revoked or mistyped key (the API cannot tell them apart). 403: the plan
   *  does not cover something in the request. */
  | { kind: "rejected"; status: 401 | 403 }
  /** 402: today's calls are spent. Resets at midnight GMT. */
  | { kind: "quota" }
  /** 429: too many requests in one minute. Clears by itself. */
  | { kind: "rate-limit"; retryAfter: string | null }
  /** The request did not get an answer we understand: network, timeout, a 5xx. */
  | { kind: "unreachable"; status: number | null };

/** The failure an HTTP status from EODHD stands for. */
export function failureFromStatus(
  status: number,
  retryAfter: string | null = null,
): Failure {
  if (status === 401 || status === 403) return { kind: "rejected", status };
  if (status === 402) return { kind: "quota" };
  if (status === 429) return { kind: "rate-limit", retryAfter };
  return { kind: "unreachable", status };
}
