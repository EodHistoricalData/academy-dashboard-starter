import { isAvailable, type Row } from "@/lib/rows";

/**
 * One owner for fetching quotes. Panels ask it for symbols; they never call the proxy.
 *
 * Three jobs, each removing a class of bug:
 *   - Deduplicate within a tick: every symbol asked for in the same tick goes out in one
 *     request for the union, and each caller gets its own rows back.
 *   - Cache with an explicit age: each row is kept with the time it was fetched, served
 *     again while younger than maxAge, and handed out with that time attached.
 *   - Share the request in flight: a second caller for a symbol already being fetched
 *     waits for that request instead of starting another.
 *
 * The fetcher and the clock come in as parameters, so this module imports no network code
 * and the tests need neither a network nor a mock. In the browser the fetcher calls
 * /api/proxy; on the server it would call eodhdFetch.
 */
export type Fetched = { row: Row; fetchedAt: number };

export function createMarketStore(
  fetchQuotes: (symbols: string[]) => Promise<Row[]>,
  now: () => number,
  maxAgeMs: number,
) {
  const cache = new Map<string, Fetched>();
  const pending = new Map<string, Promise<void>>(); // queued this tick, or in flight
  let tick: { symbols: string[]; done: Promise<void> } | null = null;

  function enqueue(symbol: string): Promise<void> {
    if (tick === null) {
      const batch: string[] = [];
      const done = Promise.resolve().then(async () => {
        tick = null; // runs after every caller in this tick has added its symbols
        try {
          const fetchedAt = now();
          for (const row of await fetchQuotes(batch)) cache.set(row.code, { row, fetchedAt });
        } finally {
          for (const s of batch) pending.delete(s);
        }
      });
      tick = { symbols: batch, done };
    }
    tick.symbols.push(symbol);
    return tick.done;
  }

  const fresh = (s: string) =>
    now() - (cache.get(s)?.fetchedAt ?? -Infinity) < maxAgeMs;

  return {
    async quotes(symbols: string[]): Promise<Fetched[]> {
      for (const s of symbols) {
        if (!fresh(s) && !pending.has(s)) pending.set(s, enqueue(s));
      }
      await Promise.all(symbols.map((s) => pending.get(s))); // shared, never repeated
      return symbols.flatMap((s) => cache.get(s) ?? []); // each with its fetchedAt
    },
    /** What is cached for a symbol, however old, without asking for it. */
    peek(symbol: string): Fetched | null {
      return cache.get(symbol) ?? null;
    },
  };
}

export type MarketStore = ReturnType<typeof createMarketStore>;

/**
 * The oldest quote time among the rows, in Unix seconds, or null. A page of quotes is only
 * as current as its stalest row, so that is the time a header shows; rows in one response
 * can be a minute or more apart.
 */
export function oldestTimestamp(rows: Row[]): number | null {
  const times = rows.filter(isAvailable).map((r) => r.timestamp);
  return times.length > 0 ? Math.min(...times) : null;
}

/**
 * The same three jobs for requests that are not a list of symbols — a screen, a daily
 * history — keyed by what they ask: one request per key at a time, an age on the answer,
 * and the answer served again while younger than maxAge.
 */
export function createRequestCache<T>(
  fetcher: (key: string) => Promise<T>,
  now: () => number,
  maxAgeMs: number,
) {
  const cache = new Map<string, { value: T; fetchedAt: number }>();
  const inFlight = new Map<string, Promise<{ value: T; fetchedAt: number }>>();

  return {
    get(key: string): Promise<{ value: T; fetchedAt: number }> {
      const hit = cache.get(key);
      if (hit && now() - hit.fetchedAt < maxAgeMs) return Promise.resolve(hit);
      let pending = inFlight.get(key);
      if (!pending) {
        pending = fetcher(key)
          .then((value) => {
            const entry = { value, fetchedAt: now() };
            cache.set(key, entry);
            return entry;
          })
          .finally(() => inFlight.delete(key));
        inFlight.set(key, pending);
      }
      return pending;
    },
  };
}

