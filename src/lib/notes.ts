/**
 * Why I am watching each ticker. Kept in this browser, keyed by ticker, never in git: notes
 * change often, they are personal, and some of them mention money.
 *
 * Keyed by ticker, not by position, so reordering the list cannot move a note onto the
 * wrong instrument.
 */
export type Notes = Record<string, { note?: string; tags?: string[] }>;

/** Bump the version when the shape changes, rather than silently breaking saved notes. */
export const NOTES_KEY = "watchlist-notes-v1";

export function loadNotes(): Notes {
  try {
    return parseNotes(localStorage.getItem(NOTES_KEY));
  } catch {
    return {}; // storage unavailable
  }
}

/**
 * Stored text to notes. Anything that is not a JSON object — half a write from a crashed
 * tab, `null`, an array — is an empty set of notes: the tool's own saved data must never
 * white-screen it.
 */
export function parseNotes(raw: string | null): Notes {
  try {
    const value: unknown = JSON.parse(raw ?? "{}");
    return value !== null && typeof value === "object" && !Array.isArray(value)
      ? (value as Notes)
      : {};
  } catch {
    return {};
  }
}

/** The notes with one ticker's note replaced. An empty note removes the entry. */
export function withNote(notes: Notes, code: string, note: string): Notes {
  const next = { ...notes };
  if (note === "") {
    const rest = { ...next[code] };
    delete rest.note;
    if (Object.keys(rest).length === 0) delete next[code];
    else next[code] = rest;
  } else {
    next[code] = { ...next[code], note };
  }
  return next;
}
