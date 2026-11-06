import { type Bar, toBars } from "@/lib/backtest/bars";
import { toTriples } from "@/lib/filters";
import type { ScreenConfig } from "@/lib/layout";
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

async function getJson(path: string, params: Record<string, string> = {}): Promise<unknown> {
  const query = new URLSearchParams(params).toString();
  const res = await fetch(`/api/proxy/${path}${query ? `?${query}` : ""}`);
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

export async function screenViaProxy(key: string): Promise<ScreenRow[]> {
  const [filters, sort] = JSON.parse(key) as [ScreenConfig["filters"], ScreenConfig["sort"]];
  const req = screenRequest({ filters: toTriples(filters), sort, limit: PAGE_LIMIT });
  return toScreenRows(await getJson(req.path, req.params));
}

export async function eodViaProxy(symbol: string): Promise<Bar[]> {
  return toBars(await getJson(`eod/${symbol}`));
}
