import { type Filter, filterParam, safe, safeSort, type Sort } from "@/lib/filters";

/**
 * A saved screen is a name and its criteria, never its results. Saving results would show
 * yesterday's answer tomorrow; saving criteria means reopening asks the market again.
 *
 * Kept in this browser like the watchlist's notes, by the same three rules: the key is
 * versioned, the parse is guarded, and screens are keyed by name, not by position.
 */
export type SavedScreen = {
  name: string;
  filters: Filter[];
  sort: Sort;
  createdAt: string;
};

export type SavedScreens = Record<string, SavedScreen>;

export const SCREENS_KEY = "screens-v1";

/**
 * Stored text to screens. Half a write is no screens rather than a blank page, and every
 * filter is checked again on the way in: storage can be edited by hand, so a screen with
 * a filter not on the list is dropped whole rather than run as something else.
 */
export function parseScreens(raw: string | null): SavedScreens {
  let value: unknown;
  try {
    value = JSON.parse(raw ?? "{}");
  } catch {
    return {};
  }
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    return {};
  }

  const screens: SavedScreens = {};
  for (const [name, entry] of Object.entries(value)) {
    const s = entry as Partial<Record<keyof SavedScreen, unknown>>;
    if (!Array.isArray(s.filters)) continue;
    const filters = s.filters.map(safe);
    const sort = safeSort(s.sort);
    if (filters.some((f) => f === null) || sort === null) continue;
    screens[name] = {
      name,
      filters: filters as Filter[],
      sort,
      createdAt: typeof s.createdAt === "string" ? s.createdAt : "",
    };
  }
  return screens;
}

export function withScreen(screens: SavedScreens, s: SavedScreen): SavedScreens {
  return { ...screens, [s.name]: s };
}

export function withoutScreen(screens: SavedScreens, name: string): SavedScreens {
  const next = { ...screens };
  delete next[name];
  return next;
}

/** Where a saved screen lives as an address: shareable, bookmarkable, re-run on load. */
export function screenHref(s: Pick<SavedScreen, "filters" | "sort">): string {
  return `/screen?${new URLSearchParams({ f: filterParam(s.filters), sort: s.sort })}`;
}
