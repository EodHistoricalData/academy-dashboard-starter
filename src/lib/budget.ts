import { estimateCalls } from "@/lib/cost";

/**
 * The refresh budget: what one refresh costs, how often each panel asks, and when the day's
 * allowance runs out at that rate. Priced from the requests the market store will send,
 * never from a constant, so the figure on screen cannot drift from the fetch.
 */
export type Request = { path: string; params: Record<string, string> };

/** One refresh's price in calls, or null if any request is not in the cost table. */
export function refreshCost(requests: Request[]): number | null {
  let total = 0;
  for (const r of requests) {
    const cost = estimateCalls(r.path, r.params);
    if (cost === null) return null; // unknown is "look it up", never zero
    total += cost;
  }
  return total;
}

/** When `left` calls run out at `perRefresh` every `everyMs`: "you hit it at 14:20". */
export function exhaustsAt(left: number, perRefresh: number, everyMs: number, now: number) {
  if (perRefresh === 0) return null;
  return new Date(now + Math.floor(left / perRefresh) * everyMs);
}

/**
 * How often a panel asks by itself. `live` is as fast as the feed changes: its quotes are
 * stamped to the minute, so a minute (see PLAN.md, Update intervals). A screen has not
 * re-screened itself in thirty seconds, a daily history changes once a day, and a backtest
 * is `manual`: history did not change, so it runs when you press run.
 */
export const REFRESH = ["live", "minutes", "daily", "manual"] as const;
export type Refresh = (typeof REFRESH)[number];

export const REFRESH_EVERY_MS: Record<Refresh, number | null> = {
  live: 60_000,
  minutes: 15 * 60_000,
  daily: 24 * 60 * 60_000,
  manual: null,
};

export const REFRESH_LABEL: Record<Refresh, string> = {
  live: "every minute",
  minutes: "every 15 min",
  daily: "once a day",
  manual: "by hand",
};

/**
 * Calls a minute for a schedule of rounds, each round priced once at its own interval. A
 * symbol two rounds share is priced in the faster one only (the caller leaves it out of the
 * slower), because the store serves it from cache there.
 */
export function callsPerMinute(rounds: { cost: number; everyMs: number }[]): number {
  return rounds.reduce((sum, r) => sum + (r.cost * 60_000) / r.everyMs, 0);
}

/**
 * Regular sessions of the exchanges this cockpit shows, in each exchange's own time zone,
 * Monday to Friday. Crypto never closes. Holidays are not known here: on one, the loop
 * asks, and the age line shows nothing moved. An exchange not on the list counts as open,
 * so the loop asks rather than going quiet without saying why.
 */
const SESSIONS: Record<string, { zone: string; open: number; close: number } | "always"> = {
  US: { zone: "America/New_York", open: 9 * 60 + 30, close: 16 * 60 },
  LSE: { zone: "Europe/London", open: 8 * 60, close: 16 * 60 + 30 },
  KO: { zone: "Asia/Seoul", open: 9 * 60, close: 15 * 60 + 30 },
  CC: "always",
};

/** Whether the market `symbol` trades on is in its regular session at `now`. */
export function marketOpen(symbol: string, now: number): boolean {
  const session = SESSIONS[symbol.slice(symbol.lastIndexOf(".") + 1)];
  if (session === undefined || session === "always") return true;
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: session.zone,
    weekday: "short",
    hour: "numeric",
    minute: "numeric",
    hourCycle: "h23",
  }).formatToParts(new Date(now));
  const part = (type: string) => parts.find((p) => p.type === type)?.value ?? "";
  if (part("weekday") === "Sat" || part("weekday") === "Sun") return false;
  const minutes = Number(part("hour")) * 60 + Number(part("minute"));
  return minutes >= session.open && minutes < session.close;
}

/**
 * Stop before the wall, not at it. The loop refreshes only while the calls left cover one
 * more refresh plus a reserve; a refresh by hand may spend the reserve, and nothing past it.
 */
export function shouldRefresh(a: {
  used: number;
  limit: number;
  perRefresh: number;
  reserve: number;
  byHand: boolean;
}) {
  const left = a.limit - a.used;
  return a.byHand ? left >= a.perRefresh : left >= a.perRefresh + a.reserve;
}

/** What the cockpit says when it stops: the count, the limit and when it resumes. */
export function pausedLine(usage: { used: number; limit: number } | null): string {
  return usage
    ? `Refresh paused: ${usage.used} of ${usage.limit} calls used today, resets at 00:00 UTC.`
    : "Refresh paused: today’s calls are used up, resets at 00:00 UTC.";
}

/**
 * One request, as the limits allow. A 429 is a busy minute: wait for Retry-After (at most a
 * minute) and ask once more. A 402 is a spent day: it comes back at once and is never
 * retried, because asking again before midnight only fails again.
 */
export async function askWithinLimits(
  send: () => Promise<Response>,
  wait: (ms: number) => Promise<void> = (ms) => new Promise((r) => setTimeout(r, ms)),
): Promise<Response> {
  const first = await send();
  if (first.status !== 429) return first;
  const header = first.headers.get("retry-after");
  const seconds = header === null ? NaN : Number(header); // a date or nothing: wait the minute
  await wait(Number.isFinite(seconds) && seconds >= 0 ? Math.min(seconds, 60) * 1000 : 60_000);
  return send();
}
