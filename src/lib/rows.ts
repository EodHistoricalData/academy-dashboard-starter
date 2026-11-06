import type { Quote } from "@/lib/quotes";

/** A symbol the API answered for but has no prices for: unknown, delisted, or not covered. */
export type Unavailable = { code: string; status: "unavailable" };

/** One line of the watchlist: a quote, or a symbol that keeps its place without one. */
export type Row = Quote | Unavailable;

type Raw = Record<string, unknown>;

/**
 * The real-time answer, turned into one row per symbol.
 *
 * Takes either shape the endpoint sends — a bare object for one ticker, an array for more —
 * so nothing downstream has to remember the difference.
 *
 * A symbol the API does not know comes back with "NA" in every numeric field. It used to be
 * filtered out, and the ticker silently vanished from the list. Now it stays, marked
 * unavailable, and the rows around it are unaffected: partial data is not a failure.
 *
 * This is the one place the shape is checked. A row that passes is a Quote everywhere
 * downstream; nothing in the components has to defend against "NA".
 */
export function toRows(body: unknown): Row[] {
  const items: unknown[] = Array.isArray(body) ? body : [body];
  const rows: Row[] = [];
  for (const item of items) {
    if (item === null || typeof item !== "object") continue;
    const raw = item as Raw;
    if (typeof raw.code !== "string") continue; // nothing to name the row by
    rows.push(
      isQuote(raw)
        ? { ...raw, volume: typeof raw.volume === "number" ? raw.volume : null }
        : { code: raw.code, status: "unavailable" },
    );
  }
  return rows;
}

export function isAvailable(row: Row): row is Quote {
  return !("status" in row);
}

function isQuote(raw: Raw): raw is Raw & Omit<Quote, "volume"> {
  return (
    typeof raw.code === "string" &&
    typeof raw.close === "number" &&
    typeof raw.change === "number" &&
    typeof raw.change_p === "number" &&
    typeof raw.timestamp === "number"
  );
}
