"use client";

import { useState } from "react";

/** A panel's title, renamed in place. The new name is saved with the layout. */
export function PanelTitle({ title, onRename }: { title: string; onRename?: (next: string) => void }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(title);
  if (!onRename) return <h2 className="truncate text-sm font-medium">{title}</h2>;
  if (editing) {
    const done = () => {
      setEditing(false);
      if (draft.trim() !== "" && draft.trim() !== title) onRename(draft.trim());
    };
    return (
      <input
        autoFocus
        value={draft}
        aria-label="Panel name"
        onChange={(e) => setDraft(e.target.value)}
        onBlur={done}
        onKeyDown={(e) => {
          if (e.key === "Enter") done();
          if (e.key === "Escape") setEditing(false);
        }}
        className="min-w-0 flex-1 rounded border border-zinc-300 bg-white px-1.5 py-0.5 text-sm font-medium dark:border-zinc-700 dark:bg-zinc-900"
      />
    );
  }
  return (
    <h2 className="flex min-w-0 items-baseline gap-2 text-sm font-medium">
      <span className="truncate">{title}</span>
      <button
        type="button"
        onClick={() => {
          setDraft(title);
          setEditing(true);
        }}
        className="text-xs font-normal text-zinc-500 underline-offset-2 hover:underline dark:text-zinc-400"
      >
        Rename
      </button>
    </h2>
  );
}
