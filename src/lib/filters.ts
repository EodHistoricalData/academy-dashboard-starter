import type { FilterTriple } from "@/lib/screens";

/**
 * Filters are values, and the set of things a person may screen on is written down here.
 *
 * This is the first tool where a person types something and it reaches a request made
 * with my key. So input is never passed through: every filter is checked against these
 * lists, and the upstream query is built from the checked values. A filter that fails is
 * dropped or refused, never repaired — a repaired filter no longer asks what was asked.
 */
export const FIELDS = [
  "market_capitalization",
  "earnings_share",
  "dividend_yield",
  "avgvol_1d",
  "sector",
] as const;
export type Field = (typeof FIELDS)[number];

export const OPS = [">", "<", "=", ">=", "<="] as const;
export type Op = (typeof OPS)[number];

export type Filter = { field: Field; op: Op; value: number | string };

/** The sectors the screener's rows use. A sector filter must name one of them. */
export const SECTORS = [
  "Basic Materials",
  "Communication Services",
  "Consumer Cyclical",
  "Consumer Defensive",
  "Energy",
  "Financial Services",
  "Healthcare",
  "Industrials",
  "Real Estate",
  "Technology",
  "Utilities",
] as const;

/** The universe is mine, not the person's: US exchanges, always added, never read from input. */
export const UNIVERSE: FilterTriple = ["exchange", "=", "us"];

export const SORTS = [
  "market_capitalization.desc",
  "market_capitalization.asc",
  "earnings_share.desc",
  "dividend_yield.desc",
  "avgvol_1d.desc",
] as const;
export type Sort = (typeof SORTS)[number];
export const DEFAULT_SORT: Sort = "market_capitalization.desc";

/** A filter, or null. Checks the field, the operator, and that the value fits the field. */
export function safe(f: unknown): Filter | null {
  if (f === null || typeof f !== "object") return null;
  const { field, op, value } = f as Record<string, unknown>;
  if (!FIELDS.includes(field as Field) || !OPS.includes(op as Op)) return null;
  if (field === "sector") {
    return op === "=" && SECTORS.includes(value as (typeof SECTORS)[number])
      ? { field, op, value: value as string }
      : null;
  }
  return typeof value === "number" && Number.isFinite(value)
    ? { field: field as Field, op: op as Op, value }
    : null;
}

export function safeSort(raw: unknown): Sort | null {
  return SORTS.includes(raw as Sort) ? (raw as Sort) : null;
}

/**
 * Rows per screen. Clamped on the server: a control in the browser is a suggestion, and a
 * stranger looping `limit=500` against a public URL spends my allowance, not theirs.
 */
export function clampLimit(raw: string | null | undefined): number {
  return Math.min(Math.max(Number(raw) || 25, 1), 100);
}

/** The checked filters as /screener takes them, with the universe added. */
export function toTriples(filters: Filter[]): FilterTriple[] {
  return [...filters.map((f): FilterTriple => [f.field, f.op, f.value]), UNIVERSE];
}

/**
 * What the proxy forwards for /screener: a query built from checked values only. Anything
 * else the caller sent is dropped; a filter, operator or sort not on the lists is refused
 * with the reason.
 */
export function checkScreenerQuery(
  query: Record<string, string>,
): { params: Record<string, string> } | { error: string } {
  let raw: unknown = [];
  if (query.filters !== undefined) {
    try {
      raw = JSON.parse(query.filters);
    } catch {
      return { error: "filters is not JSON." };
    }
  }
  if (!Array.isArray(raw)) return { error: "filters must be a list of triples." };

  const filters: Filter[] = [];
  for (const [i, item] of raw.entries()) {
    if (isUniverse(item)) continue;
    const [field, op, value] = Array.isArray(item) ? item : [];
    const checked = safe({ field, op, value });
    if (checked === null) {
      return {
        error: `Filter ${i + 1} is not one this screener allows. Fields: ${FIELDS.join(", ")}. Operators: ${OPS.join(" ")}.`,
      };
    }
    filters.push(checked);
  }

  const sort = query.sort === undefined ? DEFAULT_SORT : safeSort(query.sort);
  if (sort === null) {
    return { error: `Sort must be one of: ${SORTS.join(", ")}.` };
  }

  return {
    params: {
      filters: JSON.stringify(toTriples(filters)),
      sort,
      limit: String(clampLimit(query.limit)),
    },
  };
}

function isUniverse(item: unknown): boolean {
  return (
    Array.isArray(item) &&
    item.length === 3 &&
    item.every((v, i) => v === UNIVERSE[i])
  );
}

// The address-bar form of a screen: f=market_capitalization:gt:1000000000,sector:eq:Energy
const TOKENS: Record<string, Op> = {
  gt: ">",
  lt: "<",
  eq: "=",
  gte: ">=",
  lte: "<=",
};
const TOKEN_OF = Object.fromEntries(
  Object.entries(TOKENS).map(([token, op]) => [op, token]),
) as Record<Op, string>;

export function filterParam(filters: Filter[]): string {
  return filters
    .map((f) => `${f.field}:${TOKEN_OF[f.op]}:${f.value}`)
    .join(",");
}

/**
 * A screen from the address bar. Anything in a URL is input from a stranger — someone can
 * send you a link — so every part goes through `safe`, and what does not pass is dropped
 * and reported, not fixed.
 */
export function parseFilterParam(f: string): {
  filters: Filter[];
  dropped: string[];
} {
  const filters: Filter[] = [];
  const dropped: string[] = [];
  for (const part of f.split(",").filter(Boolean)) {
    const [field, token, ...rest] = part.split(":");
    const text = rest.join(":");
    const value = field === "sector" ? text : text.trim() === "" ? NaN : Number(text);
    const checked = safe({ field, op: TOKENS[token], value });
    if (checked) filters.push(checked);
    else dropped.push(part);
  }
  return { filters, dropped };
}
