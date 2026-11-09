import { type Bar, toBars } from "@/lib/backtest/bars";
import { askWithinLimits, type Request } from "@/lib/budget";
import { type Failure, failureFromStatus } from "@/lib/failure";
import { toTriples } from "@/lib/filters";
import type { ScreenConfig } from "@/lib/layout";
import { type Needs, unionNeeds } from "@/lib/panels";
import type { Kind } from "@/lib/quota-policy";
import { quotesRequest } from "@/lib/quote-request";
import { type Row, toRows } from "@/lib/rows";
import { PAGE_LIMIT, screenRequest, type ScreenRow, toScreenRows } from "@/lib/screen-query";

/**
 * The browser's fetchers: every market request from the dashboard goes to /api/proxy,
 * which adds the key on the server. Nothing here knows the key, and nothing here calls
 * EODHD. The market store calls these; panels never do.
 */

/** A proxy answer that was not 2xx, with what the status and body said. */
export class ProxyError extends Error {
  constructor(
    readonly status: number,
    readonly retryAfter: string | null,
    readonly body: string,
  ) {
    super(`proxy answered ${status}`);
  }
}

/**
 * What a fetcher's error means. A 503 from the proxy whose body says `kind: "no-key"` is the
 * missing key; anything thrown that is not a proxy answer is the network.
 */
export function failureOf(error: unknown): Failure {
  if (error instanceof ProxyError) {
    if (error.status === 503 && kindOf(error.body) === "no-key") return { kind: "no-key" };
    // The proxy's own quota policy, not EODHD's spent day: a refresh by hand still works.
    const held = heldBy(error.body);
    if (error.status === 402 && held) return held;
    return failureFromStatus(error.status, error.retryAfter, error.body);
  }
  return { kind: "unreachable", status: null };
}

function kindOf(body: string): unknown {
  try {
    return (JSON.parse(body) as { kind?: unknown }).kind;
  } catch {
    return null;
  }
}

function heldBy(body: string): Failure | null {
  try {
    const b = JSON.parse(body) as { stage?: unknown; error?: unknown };
    return typeof b.stage === "string" && typeof b.error === "string"
      ? { kind: "held", stage: b.stage, detail: b.error }
      : null;
  } catch {
    return null;
  }
}

/**
 * The one place the page fetches through. `kind` goes in the x-budget header: what the
 * request is for, which decides when the proxy stops sending it (src/lib/quota-policy.ts).
 */
async function getJson(path: string, params: Record<string, string>, kind: Kind): Promise<unknown> {
  const query = new URLSearchParams(params).toString();
  // A 429 waits and asks once more; a 402 is never retried (src/lib/budget.ts).
  const res = await askWithinLimits(() =>
    fetch(`/api/proxy/${path}${query ? `?${query}` : ""}`, { headers: { "x-budget": kind } }),
  );
  if (!res.ok) {
    throw new ProxyError(res.status, res.headers.get("retry-after"), await res.text());
  }
  return res.json();
}

/** One request for every symbol: the first in the path, the rest in `s`. */
export async function quotesViaProxy(symbols: string[], kind: Kind = "auto"): Promise<Row[]> {
  const req = quotesRequest(symbols);
  if (req === null) return [];
  return toRows(await getJson(req.path, req.params, kind));
}

/** The key a screen is cached under: what it asks, not which panel asked. */
export function screenKey(config: ScreenConfig): string {
  return JSON.stringify([config.filters, config.sort]);
}

/** The request a screen key stands for. */
export function screenRequestOf(key: string): Request {
  const [filters, sort] = JSON.parse(key) as [ScreenConfig["filters"], ScreenConfig["sort"]];
  return screenRequest({ filters: toTriples(filters), sort, limit: PAGE_LIMIT });
}

export async function screenViaProxy(key: string, kind: Kind = "auto"): Promise<ScreenRow[]> {
  const req = screenRequestOf(key);
  return toScreenRows(await getJson(req.path, req.params, kind));
}

export const eodRequest = (symbol: string): Request => ({ path: `eod/${symbol}`, params: {} });

export async function eodViaProxy(symbol: string, kind: Kind = "auto"): Promise<Bar[]> {
  const req = eodRequest(symbol);
  return toBars(await getJson(req.path, req.params, kind));
}

/**
 * What one fetch for these needs asks for: the union of the symbols (with the rules'
 * symbols, which ride along so the rules are checked on every answer), and each screen and
 * daily history once. The container fetches from this, and the budget prices it.
 */
export type FetchPlan = { symbols: string[]; screens: string[]; histories: string[] };

export function fetchPlan(needs: Needs[], ruleSymbols: string[] = []): FetchPlan {
  return {
    symbols: unionNeeds([...needs, { quotes: ruleSymbols }]),
    screens: [...new Set(needs.flatMap((n) => (n.screen ? [screenKey(n.screen)] : [])))],
    histories: [...new Set(needs.flatMap((n) => (n.eod ? [n.eod] : [])))],
  };
}

/** The plan without what `other` already asks for. */
export function without(plan: FetchPlan, other: FetchPlan): FetchPlan {
  return {
    symbols: plan.symbols.filter((s) => !other.symbols.includes(s)),
    screens: plan.screens.filter((s) => !other.screens.includes(s)),
    histories: plan.histories.filter((s) => !other.histories.includes(s)),
  };
}

/** The requests the fetchers above send for a plan: the same builders, so the same price. */
export function requestsOf(plan: FetchPlan): Request[] {
  const quotes = quotesRequest(plan.symbols);
  return [
    ...(quotes ? [quotes] : []),
    ...plan.screens.map(screenRequestOf),
    ...plan.histories.map(eodRequest),
  ];
}
