/**
 * Every assumption of a run, in one place, printed beside its result. Cost, slippage and
 * the fill rule sit with the rule's own numbers on purpose: they are stated assumptions of
 * the run, not settings.
 */
export type Params = {
  fast: number;
  slow: number;
  /** Fees, half the spread and impact, charged on every position change: in and out. */
  costBps: number;
  /** How much worse than the fill price you get, always against you. */
  slippageBps: number;
  /**
   * When a decision made at a bar's close is executed. "next-open" is the honest default:
   * the first price after the close you decided on. "signal-close" buys at a price known
   * only once the bar had closed, and is kept to show how much it flatters.
   */
  fill: "next-open" | "signal-close";
  /**
   * Run from this date only (YYYY-MM-DD): a trim of the history already cached, never a
   * new request. How the history wall is tested on the bars you have.
   */
  from?: string;
};

/** Chosen from the rule's textbook form and the course's cost default, before any result. */
export const DEFAULTS: Params = {
  fast: 20,
  slow: 50,
  costBps: 10,
  slippageBps: 5,
  fill: "next-open",
};

type NumericKey = "fast" | "slow" | "costBps" | "slippageBps";

/**
 * Parameters from the address bar, each checked against a range and dropped to its
 * default when it fails. These values never reach the API (the history is one request
 * whatever they are), but a slow window longer than the history, or a fast one not
 * shorter than the slow, is a run that means nothing.
 */
export function paramsFrom(query: Record<string, string | string[] | undefined>): Params {
  const int = (key: NumericKey, min: number, max: number) => {
    const raw = query[key];
    const v = typeof raw === "string" && /^\d+$/.test(raw) ? Number(raw) : NaN;
    return v >= min && v <= max ? v : DEFAULTS[key];
  };
  const fast = int("fast", 2, 100);
  const slow = int("slow", 3, 200);
  const costBps = int("costBps", 0, 100);
  const slippageBps = int("slippageBps", 0, 100);
  const fill = query.fill === "signal-close" ? "signal-close" : DEFAULTS.fill;
  const from =
    typeof query.from === "string" && /^\d{4}-\d{2}-\d{2}$/.test(query.from) ? { from: query.from } : {};
  return fast < slow
    ? { fast, slow, costBps, slippageBps, fill, ...from }
    : { ...DEFAULTS, costBps, slippageBps, fill, ...from };
}

/** The chosen parameters and their neighbours: fast ±2, slow ±5. */
export function neighbours(p: Params): Params[] {
  return [
    p,
    { ...p, fast: p.fast - 2 },
    { ...p, fast: p.fast + 2 },
    { ...p, slow: p.slow - 5 },
    { ...p, slow: p.slow + 5 },
  ].filter((n) => n.fast >= 2 && n.fast < n.slow);
}
