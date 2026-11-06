"use client";

import { useState } from "react";
import {
  parseShortlist,
  SHORTLIST_KEY,
  type Shortlist as List,
  withoutPick,
  withPick,
} from "@/lib/shortlist";
import { readStored, useStored, writeStored } from "@/lib/stored";

function save(next: List) {
  writeStored(SHORTLIST_KEY, JSON.stringify(next));
}

/**
 * The cell that promotes one result to the shortlist. It will not save without a sentence:
 * the reason is the artefact, the ticker is not.
 */
export function ShortlistCell({ code }: { code: string }) {
  const list = parseShortlist(useStored(SHORTLIST_KEY));
  const [open, setOpen] = useState(false);
  const [note, setNote] = useState("");

  if (list[code]) {
    return <span className="text-xs text-zinc-500 dark:text-zinc-400">on shortlist</span>;
  }
  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="text-xs underline underline-offset-2"
      >
        Shortlist
      </button>
    );
  }
  return (
    <form
      className="flex items-center gap-1.5"
      onSubmit={(e) => {
        e.preventDefault();
        if (note.trim() === "") return;
        const day = new Date().toISOString().slice(0, 10);
        save(withPick(parseShortlist(readStored(SHORTLIST_KEY)), code, note, day));
      }}
    >
      <input
        autoFocus
        value={note}
        onChange={(e) => setNote(e.target.value)}
        placeholder="Why is it here?"
        aria-label={`Reason for shortlisting ${code}`}
        className="w-48 rounded border border-zinc-300 bg-white px-1.5 py-0.5 text-xs dark:border-zinc-700 dark:bg-zinc-900"
      />
      <button
        type="submit"
        disabled={note.trim() === ""}
        className="text-xs underline underline-offset-2 disabled:no-underline disabled:opacity-40"
      >
        Save
      </button>
    </form>
  );
}

/** The shortlist itself: each name with the sentence that put it there. */
export function ShortlistPanel() {
  const list = parseShortlist(useStored(SHORTLIST_KEY));
  const picks = Object.values(list).sort((a, b) => a.code.localeCompare(b.code));

  return (
    <section className="flex flex-col gap-2 text-sm">
      <h2 className="text-xs font-medium uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
        Shortlist
      </h2>
      {picks.length === 0 ? (
        <p className="text-zinc-600 dark:text-zinc-400">
          Nothing yet. A name goes on with a sentence saying why, or not at all.
        </p>
      ) : (
        <ul className="flex flex-col gap-1.5">
          {picks.map((p) => (
            <li key={p.code} className="flex items-baseline gap-3">
              <span className="w-14 shrink-0 font-medium">{p.code}</span>
              <span className="text-zinc-700 dark:text-zinc-300">{p.note}</span>
              <span className="shrink-0 text-xs tabular-nums text-zinc-500 dark:text-zinc-400">
                {p.addedAt}
              </span>
              <button
                type="button"
                onClick={() =>
                  save(withoutPick(parseShortlist(readStored(SHORTLIST_KEY)), p.code))
                }
                className="ml-auto shrink-0 text-xs text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100"
              >
                Remove
              </button>
            </li>
          ))}
        </ul>
      )}
      <p className="text-xs text-zinc-500 dark:text-zinc-400">
        What I was thinking, kept in this browser. Not a recommendation.
      </p>
    </section>
  );
}
