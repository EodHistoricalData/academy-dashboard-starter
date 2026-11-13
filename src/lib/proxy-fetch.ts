import { type Bar, toBars } from "@/lib/backtest/bars";
import { askWithinLimits, type Request } from "@/lib/budget";
import { type Failure, failureFromStatus } from "@/lib/failure";
import { toTriples } from "@/lib/filters";
import type { ScreenConfig } from "@/lib/layout";
import { type Needs, sentimentKey, unionNeeds } from "@/lib/panels";
import { quotesRequest } from "@/lib/quote-request";
import { type Row, toRows } from "@/lib/rows";
import { PAGE_LIMIT, screenRequest, type ScreenRow, toScreenRows } from "@/lib/screen-query";
import { parseSentiments, type SentimentDay } from "@/lib/sentiment";

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

async function getJson(path: string, params: Record<string, string> = {}): Promise<unknown> {
  const query = new URLSearchParams(params).toString();
  // A 429 waits and asks once more; a 402 is never retried (src/lib/budget.ts).
  const res = await askWithinLimits(() => fetch(`/api/proxy/${path}${query ? `?${query}` : ""}`));
  if (!res.ok) {
    throw new ProxyError(res.status, res.headers.get("retry-after"), await res.text());
  }
  return res.json();
}

/** One request for every symbol: the first in the path, the rest in `s`. */
export async function quotesViaProxy(symbols: string[]): Promise<Row[]> {
  const req = quotesRequest(symbols);
  if (req === null) return [];
  return toRows(await getJson(req.path, req.params));
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

export async function screenViaProxy(key: string): Promise<ScreenRow[]> {
  const req = screenRequestOf(key);
  return toScreenRows(await getJson(req.path, req.params));
}

export const eodRequest = (symbol: string): Request => ({ path: `eod/${symbol}`, params: {} });

export async function eodViaProxy(symbol: string): Promise<Bar[]> {
  const req = eodRequest(symbol);
  return toBars(await getJson(req.path, req.params));
}

/** News tone for every symbol in the key, "AAPL.US,MSFT.US", in one request: 5 calls each. */
export const sentimentRequest = (key: string): Request => ({
  path: "sentiments",
  params: { s: key },
});

export async function sentimentViaProxy(key: string): Promise<Record<string, SentimentDay[]>> {
  const req = sentimentRequest(key);
  return parseSentiments(await getJson(req.path, req.params));
}

/**
 * What one fetch for these needs asks for: the union of the symbols (with the rules'
 * symbols, which ride along so the rules are checked on every answer), each screen and daily
 * history once, and the news tone in one request. The container fetches from this, and the
 * budget prices it.
 */
export type FetchPlan = {
  symbols: string[];
  screens: string[];
  histories: string[];
  /** The one news-tone request, by its key ("AAPL.US,MSFT.US"), or "" for none. */
  tone: string;
};

/**
 * `tone` is the key of the news-tone request every open panel's rows are read from: the
 * cockpit passes its union, so a plan for one panel asks, and is priced, for that union.
 */
export function fetchPlan(
  needs: Needs[],
  ruleSymbols: string[] = [],
  tone = sentimentKey(needs),
): FetchPlan {
  return {
    symbols: unionNeeds([...needs, { quotes: ruleSymbols }]),
    screens: [...new Set(needs.flatMap((n) => (n.screen ? [screenKey(n.screen)] : [])))],
    histories: [...new Set(needs.flatMap((n) => (n.eod ? [n.eod] : [])))],
    tone: needs.some((n) => n.sentiment?.length) ? tone : "",
  };
}

/** The plan without what `other` already asks for. */
export function without(plan: FetchPlan, other: FetchPlan): FetchPlan {
  return {
    symbols: plan.symbols.filter((s) => !other.symbols.includes(s)),
    screens: plan.screens.filter((s) => !other.screens.includes(s)),
    histories: plan.histories.filter((s) => !other.histories.includes(s)),
    tone: plan.tone === other.tone ? "" : plan.tone,
  };
}

/** The requests the fetchers above send for a plan: the same builders, so the same price. */
export function requestsOf(plan: FetchPlan): Request[] {
  const quotes = quotesRequest(plan.symbols);
  return [
    ...(quotes ? [quotes] : []),
    ...plan.screens.map(screenRequestOf),
    ...plan.histories.map(eodRequest),
    ...(plan.tone ? [sentimentRequest(plan.tone)] : []),
  ];
}
