import type { ReactNode } from "react";
import { PanelTitle } from "@/components/PanelTitle";
import type { Panel } from "@/lib/layout";

/**
 * Where a panel sits on the grid and the frame around it: its title, and whatever the
 * container puts inside. The position comes from the layout document, not from JSX.
 */
export function PanelFrame({
  panel,
  children,
  aside,
  onRename,
}: {
  panel: Panel;
  children?: ReactNode;
  onRename?: (title: string) => void;
  /** Small text at the right of the title bar: the panel's age, its state. */
  aside?: ReactNode;
}) {
  const { x, y, w, h } = panel.position;
  return (
    <section
      aria-label={panel.title}
      style={{ gridColumn: `${x + 1} / span ${w}`, gridRow: `${y + 1} / span ${h}` }}
      className="flex min-w-0 flex-col rounded-lg border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900 max-sm:![grid-column:auto] max-sm:![grid-row:auto]"
    >
      <header className="flex items-baseline justify-between gap-3 border-b border-zinc-100 px-4 py-2.5 dark:border-zinc-800">
        <PanelTitle title={panel.title} onRename={onRename} />
        <span className="shrink-0 text-xs text-zinc-500 dark:text-zinc-400">
          {aside ?? panel.type}
        </span>
      </header>
      {/* The layout's height is a limit, not a hint: a long list scrolls inside its panel
          instead of pushing the rest of the cockpit off the screen. */}
      <div
        className="min-h-24 flex-1 overflow-auto p-4 text-sm"
        style={{ maxHeight: `${h * 14}rem` }}
      >
        {panel.type === "placeholder" ? (
          <p className="text-zinc-600 dark:text-zinc-400">{panel.config.reason}</p>
        ) : (
          children
        )}
      </div>
    </section>
  );
}
