import type { ScreenRow } from "@/lib/screen-query";

/**
 * The heatmap's arithmetic: where each tile goes, and which colour and number it carries.
 * Pure, so the panel only draws and the tests need no browser.
 *
 * Ported from EodHistoricalData/eodhd-heatmap (MIT, the same holder as this repo), each
 * function from the place named above it, with what was changed on purpose.
 */

export type Rect = { x: number; y: number; w: number; h: number };

/** One item placed: its key, the weight it was sized by, and its rectangle. */
export type Tile = Rect & { key: string; weight: number };

type Sized = { key: string; weight: number; area: number };

/**
 * A weight a tile can be sized by. One that is missing, zero, negative or not finite
 * counts as 1, so its row is drawn as a sliver rather than left out: a missing tile reads
 * as a company that is not in the screen.
 */
function usable(weight: number | null | undefined): number {
  return typeof weight === "number" && Number.isFinite(weight) && weight > 0 ? weight : 1;
}

/**
 * The squarified treemap (Bruls, Huizing and van Wijk): rectangles with areas in proportion
 * to the weights, kept as close to square as a greedy rule gets them, so a tile can be
 * compared with its neighbours and has room for a label. Items go in largest first; each
 * joins the current row along the shorter side while that does not make the row's worst
 * aspect ratio worse, and otherwise the row is laid down and a new one started.
 *
 * Ported from EodHistoricalData/eodhd-heatmap, vendor/heatmap.js (MIT),
 * window.SquarifiedTreemap and _squarify. Changed on purpose: a loop instead of recursion
 * over slices; any weight that is not a positive finite number counts as 1; no one-item
 * shortcut, since the general case puts one item in the whole rect.
 */
export function squarify(items: { key: string; weight: number }[], rect: Rect): Tile[] {
  const weighed = items.map((it) => ({ key: it.key, weight: usable(it.weight) }));
  const total = weighed.reduce((s, it) => s + it.weight, 0);
  const queue: Sized[] = weighed
    .map((it) => ({ ...it, area: (it.weight / total) * rect.w * rect.h }))
    .sort((a, b) => b.area - a.area);

  const tiles: Tile[] = [];
  let free = rect;
  let row: Sized[] = [];
  for (const item of queue) {
    const side = Math.min(free.w, free.h);
    if (row.length > 0 && worst([...row, item], side) > worst(row, side)) {
      free = layRow(row, free, tiles);
      row = [];
    }
    if (free.w <= 0 || free.h <= 0) {
      // No room left: what remains is placed at zero size, never dropped.
      tiles.push({ key: item.key, weight: item.weight, x: free.x, y: free.y, w: 0, h: 0 });
      continue;
    }
    row.push(item);
  }
  if (row.length > 0) layRow(row, free, tiles);
  return tiles;
}

/** The worst aspect ratio in a row laid along a side of this length. Lower is squarer. */
function worst(row: Sized[], side: number): number {
  if (row.length === 0 || side <= 0) return Infinity;
  const sum = row.reduce((s, it) => s + it.area, 0);
  let ratio = 0;
  for (const { area } of row) {
    if (area <= 0) continue;
    ratio = Math.max(ratio, (side * side * area) / (sum * sum), (sum * sum) / (side * side * area));
  }
  return ratio;
}

/** Lays the row along the shorter side of `free`, adds its tiles, and returns what is left. */
function layRow(row: Sized[], free: Rect, tiles: Tile[]): Rect {
  const sum = row.reduce((s, it) => s + it.area, 0);
  if (free.h < free.w) {
    // Wider than tall: the row is a column down the left edge.
    let width = sum / free.h;
    if (!(width > 0 && Number.isFinite(width))) width = free.w;
    let y = free.y;
    for (const it of row) {
      const h = it.area / width;
      tiles.push({ key: it.key, weight: it.weight, x: free.x, y, w: width, h });
      y += h;
    }
    return { x: free.x + width, y: free.y, w: free.w - width, h: free.h };
  }
  let height = sum / free.w;
  if (!(height > 0 && Number.isFinite(height))) height = free.h;
  let x = free.x;
  for (const it of row) {
    const w = it.area / height;
    tiles.push({ key: it.key, weight: it.weight, x, y: free.y, w, h: height });
    x += w;
  }
  return { x: free.x, y: free.y + height, w: free.w, h: free.h - height };
}

/** The fields of a screen row the heatmap reads. */
export type HeatRow = Pick<
  ScreenRow,
  "code" | "exchange" | "sector" | "market_capitalization" | "refund_1d_p"
>;

/** A sector's rectangle; its name sits in the top `strip`, its rows below. */
export type SectorBox = Rect & { sector: string; strip: number };
export type RowTile<R> = Rect & { row: R; sector: string };

export const UNCLASSIFIED = "Unclassified";

/** The height of a sector's name strip, given only to a sector taller than STRIP_MIN. */
const STRIP = 14;
const STRIP_MIN = 20;

/**
 * Two levels: sectors sized by their summed market capitalisation, largest first, then each
 * sector's rows sized by their own capitalisation inside it, below the strip its name sits
 * in. A company is compared first with its sector, then the sector with the market.
 *
 * Ported from EodHistoricalData/eodhd-heatmap, vendor/heatmap.js (MIT),
 * finalTreemapLayout. Changed on purpose: a row without a sector is "Unclassified", and a
 * sector or tile too thin to see is still returned, so every row in the screen stays
 * reachable by keyboard and screen reader.
 */
export function treemap<R extends HeatRow>(
  rows: R[],
  rect: Rect,
): { sectors: SectorBox[]; tiles: RowTile<R>[] } {
  const bySector = new Map<string, R[]>();
  for (const row of rows) {
    const sector = row.sector?.trim() || UNCLASSIFIED;
    bySector.set(sector, [...(bySector.get(sector) ?? []), row]);
  }
  const boxes = squarify(
    [...bySector].map(([sector, members]) => ({
      key: sector,
      weight: members.reduce((s, r) => s + usable(r.market_capitalization), 0),
    })),
    rect,
  );

  const sectors: SectorBox[] = [];
  const tiles: RowTile<R>[] = [];
  for (const { key: sector, x, y, w, h } of boxes) {
    const strip = h > STRIP_MIN ? STRIP : 0;
    sectors.push({ sector, x, y, w, h, strip });
    const members = bySector.get(sector)!;
    const inner = { x, y: y + strip, w, h: h - strip };
    const placed = squarify(
      members.map((r, i) => ({ key: String(i), weight: r.market_capitalization })),
      inner,
    );
    for (const t of placed) {
      tiles.push({ x: t.x, y: t.y, w: t.w, h: t.h, row: members[Number(t.key)], sector });
    }
  }
  return { sectors, tiles };
}

/**
 * The day's change of a row, in per cent, or null when it has none. Never 0 for a missing
 * value: 0.0% says the price did not move, and a grey tile reading 0.0% would say it of a
 * price nobody has.
 *
 * Ported from EodHistoricalData/eodhd-heatmap, vendor/heatmap.js (MIT), HeatmapChange.ofRow.
 * Changed on purpose: `refund_1d_p` alone, since the proxy's rows carry no `refund_1d` to
 * refine it from.
 */
export function changeOf(row: { refund_1d_p?: number | null }): number | null {
  const p = row.refund_1d_p;
  return typeof p === "number" && Number.isFinite(p) ? p : null;
}

/**
 * A change as a tile shows it: one decimal, half away from zero, rounded on the decimal
 * text. Rounding the binary value reads 0.95 as 0.9 (it is stored as 0.94999…), and the
 * tile would print "+0.9%" in the colour for 1% and up. A change that rounds to zero is
 * zero: no "−0.0%" in red beside a "0.0%" in grey.
 *
 * Ported from EodHistoricalData/eodhd-heatmap, vendor/heatmap.js (MIT), HeatmapChange.round
 * and .shown. Changed on purpose: one decimal only, the one the tiles print.
 */
function shown(change: number | null): number | null {
  if (change === null || !Number.isFinite(change)) return null;
  // On the decimal text, exponent included: 1e-7 shifted by one is "1e-6", not "1e-7e1".
  const shift = (x: number, k: number) => {
    const [mantissa, exponent = "0"] = String(x).split("e");
    return Number(`${mantissa}e${Number(exponent) + k}`);
  };
  const r = shift(Math.round(shift(Math.abs(change), 1)), -1);
  return r === 0 ? 0 : change < 0 ? -r : r;
}

/** "+2.6%", "−0.9%", "0.0%", or "—" when the change is not known. */
export function formatChange(change: number | null): string {
  const r = shown(change);
  if (r === null) return "—";
  return `${r > 0 ? "+" : r < 0 ? "−" : ""}${Math.abs(r).toFixed(1)}%`;
}

/** The same change in words, for a tile's label: from the same rounding as the print. */
export function spokenChange(change: number | null): string {
  const r = shown(change);
  if (r === null) return "change unknown";
  if (r === 0) return "unchanged today";
  return `${r > 0 ? "up" : "down"} ${Math.abs(r).toFixed(1)}% today`;
}

/**
 * A tile's fill, from the change as shown. Seven steps, each dark enough that the white
 * label clears 4.5:1 (4.61 to 7.58): the labels are small, so the large-text allowance does
 * not apply. Unknown and unchanged share the grey; the printed "—" or "0.0%" tells them
 * apart, as the number does everywhere: colour is the second signal, never the only one.
 *
 * Ported from EodHistoricalData/eodhd-heatmap, vendor/heatmap.js (MIT), getChangeColor.
 * Unchanged.
 */
export function changeColor(change: number | null): string {
  const c = shown(change);
  if (c === null) return "#475569";
  if (c >= 3) return "#128651";
  if (c >= 1) return "#177a44";
  if (c > 0) return "#35684f";
  if (c === 0) return "#475569";
  if (c > -1) return "#a44148";
  if (c > -3) return "#b93e3e";
  return "#cb4242";
}
