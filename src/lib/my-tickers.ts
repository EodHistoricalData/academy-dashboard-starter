import { cookies } from "next/headers";
import { ADDED_COOKIE, parseAdded } from "@/lib/added";
import { WATCHLIST } from "@/lib/watchlist";

/**
 * The watchlist as the server renders it: the file's tickers, then any promoted from the
 * screen (checked, capped, without repeats). Server-only: it reads the request's cookies.
 */
export async function myTickers(): Promise<{ list: string[]; added: string[] }> {
  const jar = await cookies();
  const added = parseAdded(jar.get(ADDED_COOKIE)?.value).filter(
    (t) => !WATCHLIST.includes(t),
  );
  return { list: [...WATCHLIST, ...added], added };
}
