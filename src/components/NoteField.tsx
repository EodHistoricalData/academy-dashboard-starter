"use client";

import { createContext, type ReactNode, useContext } from "react";
import { type Notes, NOTES_KEY, notesFrom, withNote } from "@/lib/notes";
import { type ServerDoc, statusLine, useDoc } from "@/lib/use-doc";

type NotesDoc = { notes: Notes; save(next: Notes): void; line: string | null };

const NotesContext = createContext<NotesDoc | null>(null);

/**
 * One notes document for every row: read from the server, this browser's copy as the
 * fallback, written to both (step 1 of 3, see src/lib/use-doc.ts).
 */
export function NotesProvider({
  initial,
  signedIn,
  children,
}: {
  initial: ServerDoc;
  signedIn: boolean;
  children: ReactNode;
}) {
  const doc = useDoc({ docKey: "notes", localKey: NOTES_KEY, initial, signedIn });
  return (
    <NotesContext
      value={{ notes: notesFrom(doc.raw), save: doc.save, line: statusLine(doc.status) }}
    >
      {children}
    </NotesContext>
  );
}

/** What the last save did, said once under the table. */
export function NotesStatus() {
  const line = useContext(NotesContext)?.line;
  return line ? (
    <p className="text-xs text-zinc-500 dark:text-zinc-400" role="status">
      {line}
    </p>
  ) : null;
}

/**
 * The note editor for one row: the smallest client island that can own an input. It
 * fetches no market data and knows nothing about the key.
 */
export function NoteField({ code }: { code: string }) {
  const doc = useContext(NotesContext);
  if (!doc) throw new Error("NoteField used outside NotesProvider");
  const { notes, save } = doc;

  return (
    <input
      type="text"
      value={notes[code]?.note ?? ""}
      onChange={(e) => save(withNote(notes, code, e.target.value))}
      placeholder="Why I watch it"
      aria-label={`Note for ${code}`}
      className="w-full min-w-40 rounded border border-transparent bg-transparent px-1.5 py-1 text-sm text-zinc-900 placeholder:text-zinc-400 hover:border-zinc-200 focus:border-zinc-400 dark:text-zinc-100 dark:placeholder:text-zinc-500 dark:hover:border-zinc-800 dark:focus:border-zinc-600"
    />
  );
}
