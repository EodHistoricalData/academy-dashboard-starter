import { useSyncExternalStore } from "react";

/**
 * A value kept in this browser's localStorage, read the way React wants external state
 * read: through useSyncExternalStore, so every component showing it agrees, and the
 * server render (which has no localStorage) sees null instead of crashing.
 *
 * localStorage means this browser, this profile, until something clears it. It does not
 * follow you to another machine and nothing on a server can read it. That is the right
 * trade for preferences and notes today; a later course moves them to a server store.
 */

const listeners = new Set<() => void>();

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  // Another tab writing the same key.
  window.addEventListener("storage", listener);
  return () => {
    listeners.delete(listener);
    window.removeEventListener("storage", listener);
  };
}

/** The stored string, or null if absent or storage is unavailable. */
export function readStored(key: string): string | null {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null; // storage disabled: behave as if nothing was saved
  }
}

/** Save and tell every component reading this key. A failed write is not fatal. */
export function writeStored(key: string, value: string): void {
  try {
    window.localStorage.setItem(key, value);
  } catch {
    // Full or disabled storage: the value lives until the next reload.
  }
  for (const listener of listeners) listener();
}

export function useStored(key: string): string | null {
  return useSyncExternalStore(
    subscribe,
    () => readStored(key),
    () => null,
  );
}
