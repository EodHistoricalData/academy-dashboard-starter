"use client";

import { useState } from "react";

/**
 * Pick a layout, start a new one from the current, put the current back as it was saved,
 * or take it away as a file. Switching is local: the layouts are already here.
 */
export function LayoutSwitcher({
  names,
  current,
  status,
  onSwitch,
  onNew,
  onRevert,
  onExport,
}: {
  names: string[];
  current: string;
  status: string | null;
  onSwitch(name: string): void;
  onNew(name: string): void;
  onRevert(): void;
  onExport(): void;
}) {
  const [draft, setDraft] = useState("");
  const taken = names.includes(draft.trim());
  return (
    <div className="flex flex-col gap-2 text-sm">
      <div className="flex flex-wrap items-center gap-2">
        <label className="flex items-center gap-2">
          <span className="text-xs text-zinc-500 dark:text-zinc-400">Layout</span>
          <select
            value={current}
            onChange={(e) => onSwitch(e.target.value)}
            className="rounded border border-zinc-300 bg-white px-2 py-1 dark:border-zinc-700 dark:bg-zinc-900"
          >
            {names.map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </select>
        </label>
        <button type="button" onClick={onRevert} className={BUTTON}>
          Revert to saved
        </button>
        <button type="button" onClick={onExport} className={BUTTON}>
          Export
        </button>
        <form
          className="ml-auto flex items-center gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            if (draft.trim() === "" || taken) return;
            onNew(draft.trim());
            setDraft("");
          }}
        >
          <input
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder="The question it answers"
            aria-label="Name for a new layout"
            className="rounded border border-zinc-300 bg-white px-2 py-1 dark:border-zinc-700 dark:bg-zinc-900"
          />
          <button type="submit" disabled={draft.trim() === "" || taken} className={`${BUTTON} disabled:opacity-40`}>
            New layout from this one
          </button>
        </form>
      </div>
      {status && (
        <p className="text-xs text-zinc-500 dark:text-zinc-400" role="status">
          {status}
        </p>
      )}
    </div>
  );
}

const BUTTON = "rounded border border-zinc-300 px-2.5 py-1 dark:border-zinc-700";
