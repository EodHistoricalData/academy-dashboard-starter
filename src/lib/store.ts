import { mkdirSync } from "node:fs";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";

/**
 * The document store: one row per user per document, the document as JSON, and a version.
 *
 *   user_id | key           | version | payload        | updated_at
 *   1       | saved-screens | 3       | {"Big ...":..} | 2026-11-06T...
 *
 * The version is not decoration. Two tabs on the same dashboard both write; without it the
 * second write silently destroys the first. A writer sends the version it read, and the
 * write is refused if the row has moved since — in one statement, so two writes arriving
 * together cannot both succeed.
 *
 * Every function takes the user first. There is no way to ask for a document without
 * saying whose it is, which is the whole defence against reading someone else's.
 *
 * SQLite through Node's built-in node:sqlite, so nothing is added to package.json. The file
 * is .data/app.db (gitignored); STORE_FILE overrides it, and the tests use ":memory:".
 */

/** The documents that exist. Anything else is a 404, not a new document. */
export const DOC_KEYS = ["saved-screens", "shortlist", "notes", "layouts"] as const;
export type DocKey = (typeof DOC_KEYS)[number];

export function isDocKey(key: string): key is DocKey {
  return (DOC_KEYS as readonly string[]).includes(key);
}

export type StoredDoc = { version: number; payload: unknown; updatedAt: string };

export type PutResult =
  | { conflict: false; version: number }
  /** The other tab is ahead: here is what it wrote. */
  | { conflict: true; current: StoredDoc | null };

export type Store = {
  getDoc(user: number, key: DocKey): StoredDoc | null;
  putDoc(user: number, key: DocKey, payload: unknown, version: number): PutResult;
};

export function openStore(file: string): Store {
  if (file !== ":memory:") mkdirSync(path.dirname(file), { recursive: true });
  const db = new DatabaseSync(file);
  db.exec(`CREATE TABLE IF NOT EXISTS docs (
    user_id INTEGER NOT NULL,
    key TEXT NOT NULL,
    version INTEGER NOT NULL,
    payload TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    PRIMARY KEY (user_id, key)
  )`);

  const select = db.prepare(
    "SELECT version, payload, updated_at FROM docs WHERE user_id = ? AND key = ?",
  );
  // Version 0 means "I read nothing": insert, unless a row appeared meanwhile.
  const insert = db.prepare(
    "INSERT INTO docs (user_id, key, version, payload, updated_at) VALUES (?, ?, 1, ?, ?) ON CONFLICT DO NOTHING",
  );
  // Compare and set: only the version the writer read may be replaced.
  const update = db.prepare(
    "UPDATE docs SET version = version + 1, payload = ?, updated_at = ? WHERE user_id = ? AND key = ? AND version = ?",
  );

  function getDoc(user: number, key: DocKey): StoredDoc | null {
    const row = select.get(user, key) as
      | { version: number; payload: string; updated_at: string }
      | undefined;
    if (!row) return null;
    return {
      version: row.version,
      payload: JSON.parse(row.payload),
      updatedAt: row.updated_at,
    };
  }

  function putDoc(
    user: number,
    key: DocKey,
    payload: unknown,
    version: number,
  ): PutResult {
    const now = new Date().toISOString();
    const text = JSON.stringify(payload);
    const changed =
      version === 0
        ? insert.run(user, key, text, now).changes
        : update.run(text, now, user, key, version).changes;
    return changed === 1
      ? { conflict: false, version: version + 1 }
      : { conflict: true, current: getDoc(user, key) };
  }

  return { getDoc, putDoc };
}

let shared: Store | null = null;

/** The server's store, opened on first use. */
export function store(): Store {
  shared ??= openStore(
    process.env.STORE_FILE ?? path.join(process.cwd(), ".data", "app.db"),
  );
  return shared;
}

export function getDoc(user: number, key: DocKey): StoredDoc | null {
  return store().getDoc(user, key);
}

export function putDoc(
  user: number,
  key: DocKey,
  payload: unknown,
  version: number,
): PutResult {
  return store().putDoc(user, key, payload, version);
}
