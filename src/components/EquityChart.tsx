/**
 * Equity curves as one SVG, drawn on the server: no chart library, no client JavaScript.
 *
 * Every series shares one x axis (the bar dates) and one y scale, so lines can be compared
 * by eye. The net-of-costs line is a series like any other and is always passed in, even
 * when costs are zero and it sits on top of the gross one.
 */
export type Series = {
  label: string;
  values: number[];
  /** Tailwind stroke class. Dashed lines are for the control and gross figures. */
  stroke: string;
  dashed?: boolean;
};

const W = 720;
const H = 260;
const PAD = { top: 12, right: 12, bottom: 28, left: 48 };

export function EquityChart({
  dates,
  series,
  caption,
  band,
}: {
  dates: string[];
  series: Series[];
  caption: string;
  /** A stretch of bars to shade, such as the longest time under water. */
  band?: { from: number; to: number; label: string };
}) {
  const all = series.flatMap((s) => s.values).filter(Number.isFinite);
  if (dates.length < 2 || all.length === 0) {
    return (
      <p className="text-sm text-zinc-600 dark:text-zinc-400">
        Not enough bars to draw a curve.
      </p>
    );
  }
  const min = Math.min(...all);
  const max = Math.max(...all);
  const span = max - min || 1;
  const x = (i: number) =>
    PAD.left + (i / (dates.length - 1)) * (W - PAD.left - PAD.right);
  const y = (v: number) =>
    PAD.top + (1 - (v - min) / span) * (H - PAD.top - PAD.bottom);

  return (
    <figure className="flex flex-col gap-2">
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label={caption}>
        {band && band.to > band.from && (
          <rect
            x={x(band.from)}
            y={PAD.top}
            width={x(band.to) - x(band.from)}
            height={H - PAD.top - PAD.bottom}
            className="fill-amber-200/40 dark:fill-amber-900/30"
          >
            <title>{band.label}</title>
          </rect>
        )}
        {[min, (min + max) / 2, max].map((v) => (
          <g key={v}>
            <line
              x1={PAD.left}
              x2={W - PAD.right}
              y1={y(v)}
              y2={y(v)}
              className="stroke-zinc-200 dark:stroke-zinc-800"
            />
            <text
              x={PAD.left - 6}
              y={y(v) + 4}
              textAnchor="end"
              className="fill-zinc-500 text-[11px] tabular-nums"
            >
              {v.toFixed(2)}
            </text>
          </g>
        ))}
        {series.map((s) => (
          <polyline
            key={s.label}
            fill="none"
            strokeWidth={1.5}
            strokeDasharray={s.dashed ? "4 3" : undefined}
            className={s.stroke}
            points={s.values
              .map((v, i) => (Number.isFinite(v) ? `${x(i)},${y(v)}` : null))
              .filter(Boolean)
              .join(" ")}
          />
        ))}
        <text x={PAD.left} y={H - 8} className="fill-zinc-500 text-[11px]">
          {dates[0]}
        </text>
        <text
          x={W - PAD.right}
          y={H - 8}
          textAnchor="end"
          className="fill-zinc-500 text-[11px]"
        >
          {dates[dates.length - 1]}
        </text>
      </svg>
      <figcaption className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-zinc-600 dark:text-zinc-400">
        {band && band.to > band.from && (
          <span className="flex items-center gap-1.5">
            <span className="inline-block h-2.5 w-4 bg-amber-200/70 dark:bg-amber-900/50" />
            {band.label}
          </span>
        )}
        {series.map((s) => (
          <span key={s.label} className="flex items-center gap-1.5">
            <svg width="18" height="6" aria-hidden="true">
              <line
                x1="0"
                x2="18"
                y1="3"
                y2="3"
                strokeWidth={2}
                strokeDasharray={s.dashed ? "4 3" : undefined}
                className={s.stroke}
              />
            </svg>
            {s.label}
          </span>
        ))}
      </figcaption>
    </figure>
  );
}
