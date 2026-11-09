/**
 * Every assumption of a run, in one place, printed beside its result. Cost sits with the
 * rule's own numbers on purpose: it is a stated assumption of the run, not a setting.
 */
export type Params = {
  fast: number;
  slow: number;
  /** Charged on every position change, both ways: 10 bps in, 10 bps out. */
  costBps: number;
};

/** Chosen from the rule's textbook form before looking at any result. */
export const DEFAULTS: Params = { fast: 20, slow: 50, costBps: 10 };

/**
 * Parameters from the address bar, each checked against a range and dropped to its
 * default when it fails. These values never reach the API (the history is one request
 * whatever they are), but a slow window longer than the history, or a fast one not
 * shorter than the slow, is a run that means nothing.
 */
export function paramsFrom(query: Record<string, string | string[] | undefined>): Params {
  const int = (key: keyof Params, min: number, max: number) => {
    const raw = query[key];
    const v = typeof raw === "string" && /^\d+$/.test(raw) ? Number(raw) : NaN;
    return v >= min && v <= max ? v : DEFAULTS[key];
  };
  const fast = int("fast", 2, 100);
  const slow = int("slow", 3, 200);
  const costBps = int("costBps", 0, 100);
  return fast < slow ? { fast, slow, costBps } : { ...DEFAULTS, costBps };
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
