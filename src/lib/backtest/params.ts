import { DEFAULTS, type Params } from "@/lib/backtest/strategy";

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
