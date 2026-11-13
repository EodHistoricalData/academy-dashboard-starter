import type { KeyboardEvent } from "react";
import { toTicker } from "@/lib/added";
import {
  changeColor,
  changeOf,
  formatChange,
  type Rect,
  spokenChange,
  treemap,
} from "@/lib/heatmap";
import { type HeatmapConfig, parseScreenConfig } from "@/lib/layout";
import type { PanelDef, PanelProps } from "@/lib/panels";

/** The drawing's own coordinates. The SVG scales to the panel's width; labels scale with it. */
const VIEW: Rect = { x: 0, y: 0, w: 640, h: 360 };

// In the drawing's units: at two grid columns wide they come out at about 11 and 9 px.
const FONT = 13;
const LINE = 15;
const SECTOR_FONT = 11;

/**
 * How wide a label is, without measuring: a width per character on the generous side,
 * since a label that overflows its tile is worse than one left out. A tile without one
 * still has its aria-label and a hover title.
 */
const widthOf = (text: string, size: number) => text.length * size * 0.62 + 6;

/**
 * A screen as a map: each company a tile sized by its market capitalisation, grouped by
 * sector, coloured by today's change and labelled with it. The rows are the screen's,
 * handed in; the panel only draws them.
 */
function HeatmapPanelView({ data, onSelect }: PanelProps<HeatmapConfig>) {
  const rows = data.screen?.rows ?? [];
  if (rows.length === 0) {
    return <p className="text-sm text-zinc-600 dark:text-zinc-400">Nothing matches these filters.</p>;
  }
  const { sectors, tiles } = treemap(rows, VIEW);
  return (
    <svg
      viewBox={`0 0 ${VIEW.w} ${VIEW.h}`}
      width="100%"
      role="group"
      aria-label="Companies matching the screen, sized by market capitalisation and grouped by sector, with today’s change"
      className="block h-auto select-none"
    >
      {sectors.map((s) =>
        s.strip > 0 && widthOf(s.sector, SECTOR_FONT) <= s.w ? (
          <text
            key={s.sector}
            x={s.x + 3}
            y={s.y + s.strip - 3.5}
            fontSize={SECTOR_FONT}
            className="fill-zinc-600 dark:fill-zinc-400"
          >
            {s.sector}
          </text>
        ) : null,
      )}
      {tiles.map((t, i) => {
        const ticker = toTicker(t.row);
        const change = changeOf(t.row);
        const printed = formatChange(change);
        const selected = ticker === data.selected;
        const labelled =
          Math.max(widthOf(t.row.code, FONT), widthOf(printed, FONT)) <= t.w && 2 * LINE + 4 <= t.h;
        const select = () => onSelect(ticker);
        const onKeyDown = (e: KeyboardEvent) => {
          if (e.key !== "Enter" && e.key !== " ") return;
          e.preventDefault(); // a space would scroll the page
          select();
        };
        const cx = t.x + t.w / 2;
        const cy = t.y + t.h / 2;
        return (
          <g
            key={`${ticker}:${i}`}
            role="button"
            tabIndex={0}
            aria-label={`${t.row.code}, ${t.sector}, ${spokenChange(change)}`}
            aria-current={selected ? "true" : undefined}
            onClick={select}
            onKeyDown={onKeyDown}
            className="cursor-pointer focus-visible:outline-2 focus-visible:outline-sky-500"
          >
            {!labelled && <title>{`${t.row.code} ${printed}`}</title>}
            <rect
              x={t.x}
              y={t.y}
              width={t.w}
              height={t.h}
              fill={changeColor(change)}
              strokeWidth={1}
              className="stroke-white dark:stroke-zinc-900"
            />
            {selected && t.w > 3 && t.h > 3 && (
              // Inset, so the neighbours drawn after it cannot cover the outline.
              <rect
                x={t.x + 1.5}
                y={t.y + 1.5}
                width={t.w - 3}
                height={t.h - 3}
                fill="none"
                strokeWidth={2.5}
                className="stroke-zinc-950 dark:stroke-white"
              />
            )}
            {labelled && (
              <text
                x={cx}
                y={cy - 1.5}
                textAnchor="middle"
                fontSize={FONT}
                fill="#fff"
                className="tabular-nums"
              >
                <tspan fontWeight={600}>{t.row.code}</tspan>
                <tspan x={cx} y={cy - 1.5 + LINE}>
                  {printed}
                </tspan>
              </text>
            )}
          </g>
        );
      })}
    </svg>
  );
}

export const HeatmapPanel: PanelDef<HeatmapConfig> = {
  parse: parseScreenConfig,
  // The screen a screen panel with this config would ask for, so screenKey makes the two
  // one request when they share filters and sort.
  dataNeeds: (config) => ({ quotes: [], screen: config }),
  Component: HeatmapPanelView,
};
