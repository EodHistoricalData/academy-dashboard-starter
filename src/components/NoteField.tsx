"use client";

import { NOTES_KEY, parseNotes, withNote } from "@/lib/notes";
import { readStored, useStored, writeStored } from "@/lib/stored";

/**
 * The note editor for one row: the smallest client island that can own an input. It reads
 * and writes localStorage only; it fetches nothing and knows nothing about the key.
 */
export function NoteField({ code }: { code: string }) {
  const notes = parseNotes(useStored(NOTES_KEY));

  return (
    <input
      type="text"
      value={notes[code]?.note ?? ""}
      onChange={(e) => {
        // Re-read before writing: another row or tab may have saved since this render.
        const latest = parseNotes(readStored(NOTES_KEY));
        writeStored(
          NOTES_KEY,
          JSON.stringify(withNote(latest, code, e.target.value)),
        );
      }}
      placeholder="Why I watch it"
      aria-label={`Note for ${code}`}
      className="w-full min-w-40 rounded border border-transparent bg-transparent px-1.5 py-1 text-sm text-zinc-900 placeholder:text-zinc-400 hover:border-zinc-200 focus:border-zinc-400 dark:text-zinc-100 dark:placeholder:text-zinc-500 dark:hover:border-zinc-800 dark:focus:border-zinc-600"
    />
  );
}
