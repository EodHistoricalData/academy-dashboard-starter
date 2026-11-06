import { isTicker } from "@/lib/added";
import { DEFAULTS as BACKTEST_DEFAULTS, type Params } from "@/lib/backtest/engine";
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
export const PANEL_TYPES = ["watchlist", "screen", "backtest", "quote"] as const;
export type PanelType = (typeof PANEL_TYPES)[number];

export type Position = { x: number; y: number; w: number; h: number };

export type WatchlistConfig = { symbols: string[] };
export type ScreenConfig = { filters: Filter[]; sort: Sort };
export type BacktestConfig = Params & { symbol: string };
export type QuoteConfig = { symbol: string };

type Base = { id: string; title: string; position: Position };
export type Panel =
  | (Base & { type: "watchlist"; config: WatchlistConfig })
  | (Base & { type: "screen"; config: ScreenConfig })
  | (Base & { type: "backtest"; config: BacktestConfig })
  | (Base & { type: "quote"; config: QuoteConfig })
  /** A panel this code cannot draw: an unknown type, or a config that failed its check. */
  | (Base & { type: "placeholder"; config: { reason: string } });

export type Layout = { name: string; version: number; panels: Panel[] };

export const CURRENT_VERSION = 1;

/** A new user meets a cockpit that works: their watchlist, one screen and the backtest. */
export const DEFAULT_LAYOUT: Layout = {
  name: "Morning check",
  version: CURRENT_VERSION,
  panels: [
    {
      id: "watchlist",
      type: "watchlist",
      title: "Watchlist",
      config: { symbols: WATCHLIST },
      position: { x: 0, y: 0, w: 2, h: 2 },
    },
    {
      id: "screen",
      type: "screen",
      title: "Big and profitable",
      config: { filters: MY_FILTERS, sort: DEFAULT_SORT },
      position: { x: 2, y: 0, w: 2, h: 2 },
    },
    {
      id: "backtest",
      type: "backtest",
      title: "SPY.US, 20/50",
      config: { symbol: "SPY.US", ...BACKTEST_DEFAULTS },
      position: { x: 0, y: 2, w: 4, h: 1 },
    },
  ],
};

const MAX_SYMBOLS = 30;

export function parseWatchlistConfig(raw: unknown): WatchlistConfig | null {
  const c = raw as { symbols?: unknown } | null;
  return Array.isArray(c?.symbols) &&
    c.symbols.length <= MAX_SYMBOLS &&
    c.symbols.every(isTicker)
    ? { symbols: [...c.symbols] }
    : null;
}

export function parseScreenConfig(raw: unknown): ScreenConfig | null {
  const c = raw as { filters?: unknown; sort?: unknown } | null;
  if (!Array.isArray(c?.filters)) return null;
  const filters = c.filters.map(safe); // the course 2 allowlist
  const sort = safeSort(c.sort);
  return sort !== null && filters.every((f) => f !== null)
    ? { filters: filters as Filter[], sort }
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
    (c.fill !== "next-open" && c.fill !== "signal-close")
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
  };
}

export function parseQuoteConfig(raw: unknown): QuoteConfig | null {
  const c = raw as { symbol?: unknown } | null;
  return isTicker(c?.symbol) ? { symbol: c.symbol } : null;
}

const CHECK: Record<PanelType, (config: unknown) => object | null> = {
  watchlist: parseWatchlistConfig,
  screen: parseScreenConfig,
  backtest: parseBacktestConfig,
  quote: parseQuoteConfig,
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
