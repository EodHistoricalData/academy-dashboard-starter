/**
 * Why the watchlist came back without data.
 *
 * A market tool fails in four ways, and each has a different fix: no key, a key the API
 * rejected, a day's calls spent, and a ticker that does not exist. The last one is not
 * here, because it is not a failure of the list: it fails its own row. The rest stop the
 * whole request, and the page names which one it was rather than saying "something went
 * wrong" over all of them.
 *
 * 429 is kept apart from 402 on purpose. Both are limits, but a busy minute clears by
 * itself and a spent day does not, so waiting is right for one and useless for the other.
 */
export type Failure =
  /** The variable is not set, so nothing was sent. The API answers a missing key and a
   *  wrong one with the same 401; only the tool can tell them apart. */
  | { kind: "no-key" }
  /** 401: missing, revoked or mistyped key (the API cannot tell them apart). 403: the plan
   *  does not cover something in the request. */
  | { kind: "rejected"; status: 401 | 403 }
  /** 402: today's calls are spent. Resets at midnight GMT. */
  | { kind: "quota" }
  /** 429: too many requests in one minute. Clears by itself. */
  | { kind: "rate-limit"; retryAfter: string | null }
  /** 404: the thing asked for does not exist, usually a mistyped ticker. EODHD says so in
   *  plain text ("Ticker Not Found."), which is kept as `detail`. */
  | { kind: "not-found"; detail: string }
  /** The request did not get an answer we understand: network, timeout, a 5xx. */
  | { kind: "unreachable"; status: number | null };

/** The failure an HTTP status from EODHD stands for. */
export function failureFromStatus(
  status: number,
  retryAfter: string | null = null,
  body = "",
): Failure {
  if (status === 401 || status === 403) return { kind: "rejected", status };
  if (status === 402) return { kind: "quota" };
  if (status === 429) return { kind: "rate-limit", retryAfter };
  if (status === 404) {
    return { kind: "not-found", detail: body.trim().slice(0, 200) || "Not found." };
  }
  return { kind: "unreachable", status };
}

/**
 * What happened, and what to do next, for each kind. Five situations that need five
 * different actions; "something went wrong" over all of them tells nobody what to do.
 */
export function failureSentence(f: Failure): { what: string; next: string } {
  switch (f.kind) {
    case "no-key":
      return {
        what: "There is no API key on the server.",
        next: "Copy .env.example to .env.local, put your key in it and restart, or set EODHD_MOCK=1 to use the fixtures.",
      };
    case "rejected":
      return f.status === 401
        ? {
            what: "EODHD rejected the key (401).",
            next: "Check the key in .env.local character by character: a revoked key and a mistyped one answer the same.",
          }
        : {
            what: "Your plan does not cover this data (403).",
            next: "Waiting will not help; only a plan that includes it will.",
          };
    case "quota":
      return {
        what: "You are out of API calls for today (402).",
        next: "They reset at 00:00 UTC; asking again before then only fails. What is on screen stays, with its age.",
      };
    case "rate-limit":
      return {
        what: "Too many requests this minute (429).",
        next: `It clears by itself: wait ${f.retryAfter ?? "60"} seconds, then retry.`,
      };
    case "not-found":
      return {
        what: `EODHD does not know what was asked for (404): ${f.detail}`,
        next: "Check the ticker, including its exchange suffix.",
      };
    case "unreachable":
      return {
        what:
          f.status === null
            ? "EODHD did not answer in time."
            : `EODHD answered ${f.status}, a fault on its side.`,
        next: "That is upstream; retrying is reasonable.",
      };
  }
}
