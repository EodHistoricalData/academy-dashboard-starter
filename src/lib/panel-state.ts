import type { Failure } from "@/lib/failure";

/**
 * Five states, per panel, never per page. Refreshing never blanks what is on screen, and a
 * failure keeps the old rows too, labelled with their age: a stale number that says it is
 * stale beats an empty box.
 */
export type PanelState<R> =
  | { kind: "loading" } // a skeleton, not a spinner
  | { kind: "refreshing"; rows: R[] }
  | { kind: "ready"; rows: R[] } // with its age
  | { kind: "empty" } // and say why
  | { kind: "failed"; failure: Failure; rows: R[] | null }; // old rows stay, labelled

export function panelState<R>(p: {
  rows: R[] | null;
  fetching: boolean;
  failure: Failure | null;
}): PanelState<R> {
  if (p.failure) return { kind: "failed", failure: p.failure, rows: p.rows };
  if (p.rows === null) return { kind: "loading" };
  if (p.fetching) return { kind: "refreshing", rows: p.rows };
  if (p.rows.length === 0) return { kind: "empty" };
  return { kind: "ready", rows: p.rows };
}
