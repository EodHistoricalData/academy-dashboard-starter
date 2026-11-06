/**
 * The output of a screening session: a handful of names, each with the sentence that put it
 * there. Without the sentence, in three weeks it is a list of tickers and no memory of what
 * you were thinking; so a name cannot be added without one.
 *
 * In this browser, like notes and saved screens: versioned key, guarded parse, keyed by code.
 * It records what I was thinking. It is not a recommendation, and nothing on the page calls
 * it one.
 */
export type Pick = { code: string; note: string; addedAt: string };
export type Shortlist = Record<string, Pick>;

export const SHORTLIST_KEY = "shortlist-v1";

export function withPick(
  list: Shortlist,
  code: string,
  note: string,
  addedAt: string,
): Shortlist {
  const reason = note.trim();
  if (reason === "") throw new Error("A shortlisted name needs a reason.");
  return { ...list, [code]: { code, note: reason, addedAt } };
}

export function withoutPick(list: Shortlist, code: string): Shortlist {
  const next = { ...list };
  delete next[code];
  return next;
}

export function parseShortlist(raw: string | null): Shortlist {
  try {
    return shortlistFrom(JSON.parse(raw ?? "{}"));
  } catch {
    return {};
  }
}

/** The same checks on a value already parsed: the server's copy arrives as JSON. */
export function shortlistFrom(value: unknown): Shortlist {
  if (value === null || typeof value !== "object" || Array.isArray(value)) return {};
  const list: Shortlist = {};
  for (const [code, entry] of Object.entries(value)) {
    const p = entry as Partial<Pick>;
    if (typeof p.note !== "string" || p.note.trim() === "") continue;
    list[code] = {
      code,
      note: p.note,
      addedAt: typeof p.addedAt === "string" ? p.addedAt : "",
    };
  }
  return list;
}
