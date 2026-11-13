import type { ReactNode } from "react";
import type { Bar } from "@/lib/backtest/bars";
import type { ScreenConfig } from "@/lib/layout";
import type { Fetched } from "@/lib/market-store";
import type { Notes } from "@/lib/notes";
import type { ScreenRow } from "@/lib/screen-query";
import type { SentimentDay } from "@/lib/sentiment";

/**
 * The contract every panel signs. Four rules, each because of a failure:
 *   - data comes in: a panel that fetches cannot be tested without a network and will
 *     duplicate a request another panel already made;
 *   - config comes in already checked (src/lib/layout.ts), so a panel holds no parsing;
 *   - what happens goes out through callbacks; the container decides what it means;
 *   - no panel imports another.
 */
export type PanelProps<C> = {
  config: C; // already parsed for its type
  data: PanelData; // given, never fetched
  onSelect(symbol: string): void; // the only way out
  onConfigChange(next: C): void; // the only way to persist
};

/** Everything a panel can be handed. Each panel reads the part its needs asked for. */
export type PanelData = {
  /** Quotes for the panel's own symbols, each with the time it was fetched. */
  quotes: Fetched[];
  screen: { rows: ScreenRow[]; fetchedAt: number } | null;
  bars: { rows: Bar[]; fetchedAt: number } | null;
  /** News tone for the panel's own symbols, by symbol; a symbol with no news is absent. */
  sentiment: { bySymbol: Record<string, SentimentDay[]>; fetchedAt: number } | null;
  /** The watchlist's notes, as data like everything else. */
  notes: Notes;
  /** The selected symbol, so a panel can mark its row. Reporting a click is onSelect. */
  selected: string | null;
};

/**
 * What a panel wants. Quotes are a list of symbols, so the container can union them across
 * panels; a screen and a daily history are whole requests, deduplicated by what they ask.
 * News tone is a list of symbols too, unioned the same way: it is priced per symbol.
 */
export type Needs = {
  quotes: string[];
  screen?: ScreenConfig;
  eod?: string;
  sentiment?: string[];
};

export type PanelDef<C> = {
  parse(raw: unknown): C | null;
  dataNeeds(config: C): Needs;
  Component(props: PanelProps<C>): ReactNode;
};

/**
 * The needs of the panels that are open. A collapsed panel shows only its title, so it
 * asks for nothing: a panel nobody can see must not cost a call.
 */
export function neededBy<P extends { collapsed: boolean }>(
  panels: P[],
  needsOf: (panel: P) => Needs | null,
): Needs[] {
  return panels.flatMap((p) => {
    if (p.collapsed) return [];
    const needs = needsOf(p);
    return needs ? [needs] : [];
  });
}

// The container's one list: two panels wanting the same symbol ask once.
export const unionNeeds = (needs: { quotes: string[] }[]) => [
  ...new Set(needs.flatMap((n) => n.quotes)),
];

/**
 * Every symbol the panels show, whether as a quote or as news tone: the symbols the address
 * may select.
 */
export const symbolsOf = (needs: Needs[]) => [
  ...new Set(needs.flatMap((n) => [...n.quotes, ...(n.sentiment ?? [])])),
];

/**
 * The one news-tone request for every panel, by the symbols it asks for: the union, sorted,
 * so the same panels in another order are the same request and the same cache entry.
 * Empty when no panel wants any.
 */
export const sentimentKey = (needs: Needs[]) =>
  [...new Set(needs.flatMap((n) => n.sentiment ?? []))].sort().join(",");
