import { isTicker } from "@/lib/added";
import { DEFAULTS as BACKTEST_DEFAULTS, type Params } from "@/lib/backtest/strategy";
import { DEFAULT_SORT, type Filter, safe, safeSort, type Sort } from "@/lib/filters";
import { parseTrades, type Trade } from "@/lib/portfolio";
import { MY_FILTERS } from "@/lib/screen-query";
import { WATCHLIST } from "@/lib/watchlist";

/**
 * A layout is a document: panels with a type, a config and a position. Saving, naming,
 * restoring, sharing, diffing and reverting then come without new mechanisms.
 *
 * A layout decides which requests the server makes with the key, so it is read as input
 * from a stranger: each panel's config is checked by its own type's check, a config that
 * fails is refused (never repaired), and a type this code does not know becomes a
 * placeholder that says so. One bad panel never takes down the cockpit.
 */
export const PANEL_TYPES = [
  "watchlist",
  "screen",
  "backtest",
  "quote",
  "heatmap",
  "sentiment",
  "portfolio",
] as const;
export type PanelType = (typeof PANEL_TYPES)[number];

export type Position = { x: number; y: number; w: number; h: number };

/**
 * `follows`: whether the panel shows the selected instrument. Saved with the layout, so the
 * same panel can follow in one layout and stay pinned in another.
 */
export type WatchlistConfig = { symbols: string[]; follows: boolean };
export type ScreenConfig = { filters: Filter[]; sort: Sort; follows: boolean };
export type BacktestConfig = Params & { symbol: string; follows: boolean };
export type QuoteConfig = { symbol: string; follows: boolean };
/** A heatmap draws a screen: the same filters and sort, so the same request. */
export type HeatmapConfig = ScreenConfig;
export type SentimentConfig = { symbols: string[]; follows: boolean };
/** The trades live in the config, so they are saved with the layout. */
export type PortfolioConfig = { trades: Trade[]; follows: boolean };

/** `collapsed`: only the title shows, and the panel asks for nothing. Saved with the layout. */
type Base = { id: string; title: string; position: Position; collapsed: boolean };
export type Panel =
  | (Base & { type: "watchlist"; config: WatchlistConfig })
  | (Base & { type: "screen"; config: ScreenConfig })
  | (Base & { type: "backtest"; config: BacktestConfig })
  | (Base & { type: "quote"; config: QuoteConfig })
  | (Base & { type: "heatmap"; config: HeatmapConfig })
  | (Base & { type: "sentiment"; config: SentimentConfig })
  | (Base & { type: "portfolio"; config: PortfolioConfig })
  /** A panel this code cannot draw: an unknown type, or a config that failed its check. */
  | (Base & { type: "placeholder"; config: { reason: string } });

export type Layout = { name: string; version: number; panels: Panel[] };

export const CURRENT_VERSION = 2;

/** A new user meets a cockpit that works: their watchlist, one screen and the backtest. */
export const DEFAULT_LAYOUT: Layout = {
  name: "Morning check",
  version: CURRENT_VERSION,
  panels: [
    {
      id: "watchlist",
      type: "watchlist",
      title: "Watchlist",
      config: { symbols: WATCHLIST, follows: false }, // kept still on purpose
      position: { x: 0, y: 0, w: 2, h: 2 },
      collapsed: false,
    },
    {
      id: "screen",
      type: "screen",
      title: "Big and profitable",
      config: { filters: MY_FILTERS, sort: DEFAULT_SORT, follows: false },
      position: { x: 2, y: 0, w: 2, h: 2 },
      collapsed: false,
    },
    {
      id: "quote",
      type: "quote",
      title: "Quote",
      config: { symbol: WATCHLIST[0], follows: true }, // shows what you select
      position: { x: 0, y: 2, w: 1, h: 1 },
      collapsed: false,
    },
    {
      id: "backtest",
      type: "backtest",
      title: "SPY.US, 20/50",
      config: { symbol: "SPY.US", ...BACKTEST_DEFAULTS, follows: false },
      position: { x: 1, y: 2, w: 3, h: 1 },
      collapsed: false,
    },
  ],
};

/**
 * The second built-in: the same screen as a map, sized by market capitalisation, and a
 * quote that shows the tile you click. Offered beside the saved layouts by layoutsFrom; a
 * saved layout of the same name wins. The heatmap asks what the default's screen panel
 * asks, so switching between the two layouts is one screener request, not two.
 */
export const MARKETS_LAYOUT: Layout = {
  name: "Markets",
  version: CURRENT_VERSION,
  panels: [
    {
      id: "heatmap",
      type: "heatmap",
      title: "Big and profitable, by size",
      config: { filters: MY_FILTERS, sort: "market_capitalization.desc", follows: false },
      position: { x: 0, y: 0, w: 2, h: 2 },
      collapsed: false,
    },
    {
      id: "quote",
      type: "quote",
      title: "Quote",
      // Shows the tile you click. It starts on a symbol the portfolio holds, so its quote
      // is in the request the portfolio already makes.
      config: { symbol: "NVDA.US", follows: true },
      position: { x: 2, y: 0, w: 2, h: 1 },
      collapsed: false,
    },
    {
      id: "sentiment",
      type: "sentiment",
      title: "News tone",
      // Pinned: a panel priced per symbol that followed the selection would spend 5 calls on
      // every click.
      config: { symbols: ["AAPL.US", "MSFT.US"], follows: false },
      position: { x: 2, y: 1, w: 2, h: 1 },
      collapsed: false,
    },
    {
      id: "portfolio",
      type: "portfolio",
      title: "Portfolio",
      // Examples on symbols the fixtures can price, so mock mode shows a working book.
      config: {
        trades: [
          { id: "1", symbol: "AAPL.US", side: "buy", date: "2026-03-02", quantity: 20, price: 214.5, fees: 1 },
          { id: "2", symbol: "MSFT.US", side: "buy", date: "2026-04-14", quantity: 5, price: 398.2, fees: 1 },
          { id: "3", symbol: "NVDA.US", side: "buy", date: "2026-05-11", quantity: 40, price: 129.8, fees: 1 },
          { id: "4", symbol: "AAPL.US", side: "buy", date: "2026-08-04", quantity: 10, price: 229.1, fees: 1 },
          { id: "5", symbol: "NVDA.US", side: "sell", date: "2026-09-15", quantity: 15, price: 176.4, fees: 1 },
        ],
        follows: false,
      },
      position: { x: 0, y: 2, w: 4, h: 2 },
      collapsed: false,
    },
  ],
};

const MAX_SYMBOLS = 30;

export function parseWatchlistConfig(raw: unknown): WatchlistConfig | null {
  const c = raw as { symbols?: unknown; follows?: unknown } | null;
  return Array.isArray(c?.symbols) &&
    c.symbols.length <= MAX_SYMBOLS &&
    c.symbols.every(isTicker) &&
    typeof c.follows === "boolean"
    ? { symbols: [...c.symbols], follows: c.follows }
    : null;
}

export function parseScreenConfig(raw: unknown): ScreenConfig | null {
  const c = raw as { filters?: unknown; sort?: unknown; follows?: unknown } | null;
  if (!Array.isArray(c?.filters) || typeof c.follows !== "boolean") return null;
  const filters = c.filters.map(safe); // the course 2 allowlist
  const sort = safeSort(c.sort);
  return sort !== null && filters.every((f) => f !== null)
    ? { filters: filters as Filter[], sort, follows: c.follows }
    : null;
}

export function parseBacktestConfig(raw: unknown): BacktestConfig | null {
  const c = raw as Record<string, unknown> | null;
  if (!c || !isTicker(c.symbol)) return null;
  const int = (v: unknown, min: number, max: number) =>
    Number.isInteger(v) && (v as number) >= min && (v as number) <= max;
  if (
    !int(c.fast, 2, 100) ||
    !int(c.slow, 3, 200) ||
    (c.fast as number) >= (c.slow as number) ||
    !int(c.costBps, 0, 100) ||
    !int(c.slippageBps, 0, 100) ||
    (c.fill !== "next-open" && c.fill !== "signal-close") ||
    typeof c.follows !== "boolean"
  ) {
    return null;
  }
  return {
    symbol: c.symbol,
    fast: c.fast as number,
    slow: c.slow as number,
    costBps: c.costBps as number,
    slippageBps: c.slippageBps as number,
    fill: c.fill,
    follows: c.follows,
  };
}

/** Five symbols at most: each one is 5 calls on every load. */
const MAX_SENTIMENT_SYMBOLS = 5;

export function parseSentimentConfig(raw: unknown): SentimentConfig | null {
  const c = raw as { symbols?: unknown; follows?: unknown } | null;
  return Array.isArray(c?.symbols) &&
    c.symbols.length >= 1 &&
    c.symbols.length <= MAX_SENTIMENT_SYMBOLS &&
    c.symbols.every(isTicker) &&
    new Set(c.symbols).size === c.symbols.length &&
    typeof c.follows === "boolean"
    ? { symbols: [...c.symbols], follows: c.follows }
    : null;
}

export function parsePortfolioConfig(raw: unknown): PortfolioConfig | null {
  const c = raw as { trades?: unknown; follows?: unknown } | null;
  const trades = parseTrades(c?.trades); // refused whole, never one trade dropped
  return trades !== null && typeof c?.follows === "boolean"
    ? { trades, follows: c.follows }
    : null;
}

export function parseQuoteConfig(raw: unknown): QuoteConfig | null {
  const c = raw as { symbol?: unknown; follows?: unknown } | null;
  return isTicker(c?.symbol) && typeof c.follows === "boolean"
    ? { symbol: c.symbol, follows: c.follows }
    : null;
}

const CHECK: Record<PanelType, (config: unknown) => object | null> = {
  watchlist: parseWatchlistConfig,
  screen: parseScreenConfig,
  backtest: parseBacktestConfig,
  quote: parseQuoteConfig,
  heatmap: parseScreenConfig, // a screen's config, checked as one
  sentiment: parseSentimentConfig,
  portfolio: parsePortfolioConfig,
};

/**
 * Migrations from each version to the next, run on read; the document is saved at the
 * current version. Written when the shape changes, not later.
 */
const MIGRATIONS: Record<number, (doc: RawLayout) => RawLayout> = {
  // Version 0 had no titles: a panel was called by its type.
  0: (d) => ({
    ...d,
    panels: d.panels.map((p) => ({ ...p, title: p.title ?? p.type })),
  }),
  // Version 1 had no `follows`: quote panels followed the selection, nothing else did.
  1: (d) => ({
    ...d,
    panels: d.panels.map((p) => {
      const config = (p.config ?? {}) as Record<string, unknown>;
      return "follows" in config
        ? p
        : { ...p, config: { ...config, follows: p.type === "quote" } };
    }),
  }),
};

type RawPanel = Record<string, unknown> & { title?: unknown; type?: unknown };
type RawLayout = { name: string; version: number; panels: RawPanel[] };

function migrate(raw: unknown): RawLayout | null {
  const d = raw as { name?: unknown; version?: unknown; panels?: unknown } | null;
  if (!d || typeof d !== "object" || !Array.isArray(d.panels)) return null;
  const version = d.version === undefined ? 0 : d.version;
  if (!Number.isInteger(version) || (version as number) < 0) return null;
  let doc: RawLayout = {
    name: typeof d.name === "string" && d.name.trim() !== "" ? d.name : DEFAULT_LAYOUT.name,
    version: version as number,
    panels: d.panels.filter((p): p is RawPanel => p !== null && typeof p === "object"),
  };
  for (let v = doc.version; v < CURRENT_VERSION; v++) {
    doc = { ...MIGRATIONS[v](doc), version: v + 1 };
  }
  return doc;
}

/** A layout from whatever was stored or sent: checked, migrated, never trusted. */
export function parseLayout(raw: unknown): Layout {
  const doc = migrate(raw);
  if (doc === null) return DEFAULT_LAYOUT;
  return {
    name: doc.name,
    version: CURRENT_VERSION,
    panels: doc.panels.map((p, i) => {
      const base: Base = {
        id: typeof p.id === "string" && p.id !== "" ? p.id : `panel-${i}`,
        title: typeof p.title === "string" ? p.title : "Untitled",
        position: positionOf(p.position),
        collapsed: p.collapsed === true,
      };
      const type = p.type;
      if (typeof type !== "string" || !Object.hasOwn(CHECK, type)) {
        return placeholder(base, `This cockpit does not know the panel type “${String(type)}”.`);
      }
      const config = CHECK[type as PanelType](p.config);
      return config === null
        ? placeholder(base, `This ${type} panel’s settings did not pass their check, so it was not drawn.`)
        : ({ ...base, type, config } as Panel);
    }),
  };
}

function placeholder(base: Base, reason: string): Panel {
  return { ...base, type: "placeholder", config: { reason } };
}

function positionOf(raw: unknown): Position {
  const p = raw as Partial<Position> | null;
  const ok = (v: unknown, min: number) => Number.isInteger(v) && (v as number) >= min && (v as number) <= 12;
  return p && ok(p.x, 0) && ok(p.y, 0) && ok(p.w, 1) && ok(p.h, 1)
    ? { x: p.x!, y: p.y!, w: p.w!, h: p.h! }
    : { x: 0, y: 0, w: 2, h: 1 };
}
