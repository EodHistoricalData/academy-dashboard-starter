import { readFile, writeFile } from "node:fs/promises";

/**
 * What the alert remembers between runs, in alerts/state.json, which the workflow commits
 * back after every run because each run starts on a fresh machine.
 *
 * Ids, keys and dates only, never a price: the repository is public, and a file of nightly
 * closes would be a copy of data you may not redistribute.
 */
export type KeyRecord = {
  status: "pending" | "sent";
  /** The New York date the message went out, or null while pending. */
  sent: string | null;
};

export type State = {
  /** Per symbol, the newest bar date already judged. */
  symbols: Record<string, string>;
  /** Per firing, keyed "<rule id>:<bar date>": the run's own time is nowhere in it. */
  keys: Record<string, KeyRecord>;
};

export const STATE_FILE = "alerts/state.json";

/** Mock runs keep their own, gitignored state, so fixture dates never reach the real one. */
export const MOCK_STATE_FILE = "alerts/state.mock.json";

export function emptyState(): State {
  return { symbols: {}, keys: {} };
}

export function firingKey(ruleId: string, barDate: string): string {
  return `${ruleId}:${barDate}`;
}

/** The rule id and bar date back out of a key. The date is last, so an id may hold ":". */
export function parseKey(key: string): { ruleId: string; barDate: string } {
  const at = key.lastIndexOf(":");
  return { ruleId: key.slice(0, at), barDate: key.slice(at + 1) };
}

export function pendingKeys(state: State): string[] {
  return Object.keys(state.keys)
    .filter((k) => state.keys[k].status === "pending")
    .sort();
}

export function markPending(state: State, keys: string[]): void {
  for (const k of keys) state.keys[k] = { status: "pending", sent: null };
}

export function markSent(state: State, keys: string[], date: string): void {
  for (const k of keys) state.keys[k] = { status: "sent", sent: date };
}

/** A state from parsed JSON. Anything unrecognised is dropped rather than trusted. */
export function parseState(data: unknown): State {
  const state = emptyState();
  if (data === null || typeof data !== "object") return state;
  const { symbols, keys } = data as Record<string, unknown>;

  if (symbols && typeof symbols === "object") {
    for (const [symbol, date] of Object.entries(symbols)) {
      if (typeof date === "string") state.symbols[symbol] = date;
    }
  }
  if (keys && typeof keys === "object") {
    for (const [key, raw] of Object.entries(keys)) {
      const r = raw as Partial<KeyRecord> | null;
      if (r?.status === "pending") state.keys[key] = { status: "pending", sent: null };
      if (r?.status === "sent") {
        state.keys[key] = { status: "sent", sent: typeof r.sent === "string" ? r.sent : null };
      }
    }
  }
  return state;
}

/** The saved state, or an empty one when there is no file yet. */
export async function loadState(file: string): Promise<State> {
  try {
    return parseState(JSON.parse(await readFile(file, "utf8")));
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return emptyState();
    throw error;
  }
}

/** Written with sorted keys, so the committed diff shows what changed and nothing else. */
export async function saveState(file: string, state: State): Promise<void> {
  const sorted = (o: Record<string, unknown>) =>
    Object.fromEntries(Object.entries(o).sort(([a], [b]) => a.localeCompare(b)));
  const out = { symbols: sorted(state.symbols), keys: sorted(state.keys) };
  await writeFile(file, `${JSON.stringify(out, null, 2)}\n`);
}
