import { isTicker } from "@/lib/added";
import { DEFAULTS as BACKTEST_DEFAULTS, type Params } from "@/lib/backtest/strategy";
import { REFRESH, type Refresh } from "@/lib/budget";
import { DEFAULT_SORT, type Filter, safe, safeSort, type Sort } from "@/lib/filters";
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
export const PANEL_TYPES = ["watchlist", "screen", "backtest", "quote", "heatmap"] as const;
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

/**
 * `collapsed`: only the title shows, and the panel asks for nothing. `refresh`: how often
 * it asks by itself (src/lib/budget.ts). Both saved with the layout.
 */
type Base = {
  id: string;
  title: string;
  position: Position;
  collapsed: boolean;
  refresh: Refresh;
};
export type Panel =
  | (Base & { type: "watchlist"; config: WatchlistConfig })
  | (Base & { type: "screen"; config: ScreenConfig })
  | (Base & { type: "backtest"; config: BacktestConfig })
  | (Base & { type: "quote"; config: QuoteConfig })
  | (Base & { type: "heatmap"; config: HeatmapConfig })
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
      refresh: "live",
    },
    {
      id: "screen",
      type: "screen",
      title: "Big and profitable",
      config: { filters: MY_FILTERS, sort: DEFAULT_SORT, follows: false },
      position: { x: 2, y: 0, w: 2, h: 2 },
      collapsed: false,
      refresh: "minutes",
    },
    {
      id: "quote",
      type: "quote",
      title: "Quote",
      config: { symbol: WATCHLIST[0], follows: true }, // shows what you select
      position: { x: 0, y: 2, w: 1, h: 1 },
      collapsed: false,
      refresh: "live",
    },
    {
      id: "backtest",
      type: "backtest",
      title: "SPY.US, 20/50",
      config: { symbol: "SPY.US", ...BACKTEST_DEFAULTS, follows: false },
      position: { x: 1, y: 2, w: 3, h: 1 },
      collapsed: false,
      refresh: "manual",
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
      position: { x: 0, y: 0, w: 3, h: 3 },
      collapsed: false,
      refresh: "minutes",
    },
    {
      id: "quote",
      type: "quote",
      title: "Quote",
      config: { symbol: WATCHLIST[0], follows: true }, // shows the tile you click
      position: { x: 3, y: 0, w: 1, h: 1 },
      collapsed: false,
      refresh: "live",
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

export function parseQuoteConfig(raw: unknown): QuoteConfig | null {
  const c = raw as { symbol?: unknown; follows?: unknown } | null;
  return isTicker(c?.symbol) && typeof c.follows === "boolean"
    ? { symbol: c.symbol, follows: c.follows }
    : null;
}

/**
 * How often each type asks by itself when a stored panel does not say (it was saved before
 * panels had an interval). A backtest is manual and cannot be set otherwise: it is a
 * computation over history, and history did not change.
 */
const DEFAULT_REFRESH: Record<PanelType, Refresh> = {
  watchlist: "live",
  screen: "minutes",
  quote: "live",
  backtest: "manual",
  heatmap: "minutes", // the screen's own request, so the screen's interval
};

function refreshOf(type: PanelType, raw: unknown): Refresh | null {
  if (raw === undefined) return DEFAULT_REFRESH[type];
  if (!REFRESH.includes(raw as Refresh)) return null;
  return type === "backtest" && raw !== "manual" ? null : (raw as Refresh);
}

const CHECK: Record<PanelType, (config: unknown) => object | null> = {
  watchlist: parseWatchlistConfig,
  screen: parseScreenConfig,
  backtest: parseBacktestConfig,
  quote: parseQuoteConfig,
  heatmap: parseScreenConfig, // a screen's config, checked as one
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
        refresh: "manual", // a placeholder asks for nothing
      };
      const type = p.type;
      if (typeof type !== "string" || !Object.hasOwn(CHECK, type)) {
        return placeholder(base, `This cockpit does not know the panel type “${String(type)}”.`);
      }
      const config = CHECK[type as PanelType](p.config);
      const refresh = refreshOf(type as PanelType, p.refresh);
      return config === null || refresh === null
        ? placeholder(base, `This ${type} panel’s settings did not pass their check, so it was not drawn.`)
        : ({ ...base, refresh, type, config } as Panel);
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
