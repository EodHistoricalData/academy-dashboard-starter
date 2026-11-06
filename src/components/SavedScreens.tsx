"use client";

import Link from "next/link";
import { useState } from "react";
import type { Filter, Sort } from "@/lib/filters";
import {
  parseScreens,
  SCREENS_KEY,
  screenHref,
  withoutScreen,
  withScreen,
} from "@/lib/saved-screens";
import { readStored, useStored, writeStored } from "@/lib/stored";

/**
 * Save the screen on the page under a name, and reopen any saved one. Reopening is a
 * link to its address, so the screen runs again on today's data; nothing here fetches.
 */
export function SavedScreens({
  filters,
  sort,
}: {
  filters: Filter[];
  sort: Sort;
}) {
  const screens = parseScreens(useStored(SCREENS_KEY));
  const [name, setName] = useState("");
  const names = Object.keys(screens).sort((a, b) => a.localeCompare(b));

  const save = (next: ReturnType<typeof parseScreens>) =>
    writeStored(SCREENS_KEY, JSON.stringify(next));

  return (
    <section className="flex flex-col gap-2 text-sm">
      <h2 className="text-xs font-medium uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
        Saved screens
      </h2>
      {names.length === 0 ? (
        <p className="text-zinc-600 dark:text-zinc-400">None saved yet.</p>
      ) : (
        <ul className="flex flex-col gap-1">
          {names.map((n) => (
            <li key={n} className="flex items-center gap-3">
              <Link href={screenHref(screens[n])} className="underline underline-offset-2">
                {n}
              </Link>
              <button
                type="button"
                onClick={() =>
                  save(withoutScreen(parseScreens(readStored(SCREENS_KEY)), n))
                }
                className="text-xs text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100"
              >
                Delete
              </button>
            </li>
          ))}
        </ul>
      )}
      <form
        className="flex flex-wrap items-center gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          const trimmed = name.trim();
          if (!trimmed) return;
          save(
            withScreen(parseScreens(readStored(SCREENS_KEY)), {
              name: trimmed,
              filters,
              sort,
              createdAt: new Date().toISOString(),
            }),
          );
          setName("");
        }}
      >
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Name this screen"
          aria-label="Name for this screen"
          className="rounded border border-zinc-300 bg-white px-2 py-1 text-sm dark:border-zinc-700 dark:bg-zinc-900"
        />
        <button
          type="submit"
          disabled={name.trim() === ""}
          className="rounded border border-zinc-300 px-2.5 py-1 disabled:opacity-40 dark:border-zinc-700"
        >
          Save the screen above
        </button>
        <span className="text-xs text-zinc-500 dark:text-zinc-400">
          Saves the filters, not the results.
        </span>
      </form>
    </section>
  );
}
