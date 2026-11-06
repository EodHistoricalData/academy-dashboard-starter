"use server";

import { cookies } from "next/headers";
import {
  ADDED_COOKIE,
  isTicker,
  parseAdded,
  withAdded,
  withoutAdded,
} from "@/lib/added";

/**
 * Add or remove a ticker promoted from the screen. Runs on the server: the value is checked
 * here, whatever the button sent, before it can reach a request made with the key. Setting
 * the cookie re-renders the page in the same round trip.
 */
export async function addToWatchlist(ticker: string): Promise<void> {
  if (!isTicker(ticker)) return;
  await update((list) => withAdded(list, ticker));
}

export async function removeFromWatchlist(ticker: string): Promise<void> {
  await update((list) => withoutAdded(list, ticker));
}

async function update(change: (list: string[]) => string[]): Promise<void> {
  const jar = await cookies();
  const next = change(parseAdded(jar.get(ADDED_COOKIE)?.value));
  jar.set(ADDED_COOKIE, JSON.stringify(next), {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
  });
}
