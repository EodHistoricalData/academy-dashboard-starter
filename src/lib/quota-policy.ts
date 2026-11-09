/**
 * The degradation order, written down as data. Nothing counts calls per kind of request, so
 * the order is a set of stopping points on the one count every server instance shares: each
 * kind stops at its own share of the daily limit, and the last tenth is left for a refresh
 * someone pressed.
 *
 *   background  a request nobody is looking at, or one that does not say   stops at 50%
 *   auto        a visible panel's own fetch: its first load, its timer       stops at 75%
 *   alert       a check made only for an alert rule                          stops at 90%
 *   manual      a refresh the person pressed                                 stops at the limit
 */
export const STOP_AT = { background: 0.5, auto: 0.75, alert: 0.9, manual: 1 } as const;
export type Kind = keyof typeof STOP_AT;

/** The page says what a request is in the x-budget header; anything else is background. */
export function kindOf(header: string | null): Kind {
  return header !== null && Object.hasOwn(STOP_AT, header) ? (header as Kind) : "background";
}

/**
 * Whether a request of this kind, costing `cost` calls, may go out at this count: only if
 * the count after it is still within the kind's share. Priced, so one request of five
 * hundred tickers cannot walk past every stage at once.
 */
export function admit(kind: Kind, used: number | null, limit: number | null, cost = 1): boolean {
  if (used === null || limit === null) return kind === "manual"; // spending blind is how the day goes
  return used + cost <= limit * STOP_AT[kind];
}

/** Of two kinds, the one that stops later: a batch asked for by both goes out as that one. */
export function moreUrgent(a: Kind, b: Kind): Kind {
  return STOP_AT[a] >= STOP_AT[b] ? a : b;
}

const WHAT: Record<Kind, string> = {
  background: "requests that do not say what they are for",
  auto: "a panel's own fetches and its timer",
  alert: "checks made for alert rules",
  manual: "refreshes you press",
};

/** Why a request was refused, naming the stage, in one sentence. */
export function stageSentence(kind: Kind, used: number | null, limit: number | null): string {
  if (used === null || limit === null) {
    return "Today's count could not be read, so only a refresh you press is sent.";
  }
  const share = `${Math.round(STOP_AT[kind] * 100)}%`;
  return kind === "manual"
    ? `All ${limit} of today's calls are used. Everything resumes at 00:00 UTC.`
    : `${used} of ${limit} calls are used today, and ${WHAT[kind]} stop at ${share}. A refresh you press is still served until the limit; everything resumes at 00:00 UTC.`;
}
