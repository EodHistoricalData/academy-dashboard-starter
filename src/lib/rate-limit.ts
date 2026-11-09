/**
 * Two limits on the proxy, as pure functions so a test can drive the clock.
 *
 * The upstream API limits you; nothing limits whoever calls your deployment. A per-address
 * limit bounds each caller, and addresses are cheap, so a daily ceiling bounds them all: a
 * public proxy with neither is a free market-data API you are paying for.
 */

/** Whether `caller` may make one more request at `now`: at most `perMinute` in any minute. */
export function allow(
  hits: Map<string, number[]>,
  caller: string,
  now: number,
  perMinute = 30,
): boolean {
  if (hits.size > 5_000) hits.clear(); // bounded memory; the ceiling still holds
  const recent = (hits.get(caller) ?? []).filter((t) => now - t < 60_000);
  const ok = recent.length < perMinute;
  if (ok) recent.push(now);
  hits.set(caller, recent);
  return ok;
}

/** Seconds until `caller`'s oldest request this minute leaves the window. */
export function retryAfter(hits: Map<string, number[]>, caller: string, now: number): number {
  const oldest = hits.get(caller)?.[0];
  return oldest === undefined ? 1 : Math.max(1, Math.ceil((60_000 - (now - oldest)) / 1000));
}

/** Whether today's count has reached `share` of the limit. A count it could not read is not over. */
export function overCeiling(used: number | null, limit: number | null, share = 0.9): boolean {
  return used !== null && limit !== null && used >= Math.floor(limit * share);
}
