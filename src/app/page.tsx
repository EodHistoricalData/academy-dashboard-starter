import { Alerts } from "@/components/Alerts";
import { Freshness } from "@/components/Freshness";
import { NotesProvider, NotesStatus } from "@/components/NoteField";
import { SortedWatchlist } from "@/components/SortedWatchlist";
import { CallFailed, Code, MockMode, NoKey, UserLine } from "@/components/Notices";
import { WallMeter } from "@/components/WallMeter";
import { hasKey, isMock } from "@/lib/eodhd";
import { account, ageMinutes, pageLoadCalls, quotes } from "@/lib/quotes";
import { isAvailable } from "@/lib/rows";
import { Nav } from "@/components/Nav";
import { removeFromWatchlist } from "@/app/watchlist-actions";
import { myTickers } from "@/lib/my-tickers";
import { getDoc } from "@/lib/store";
import { currentUser } from "@/lib/user";
import { firedAlerts, RULES } from "@/lib/rules";

// Server-rendered on every request, never prerendered: a page built at deploy time would
// show prices from deploy time. The whole point is that these numbers are yours and current.
export const dynamic = "force-dynamic";

export default async function Home() {
  const mock = isMock();
  // The file's tickers, plus any added from the screen.
  const { list, added } = await myTickers();
  const user = await currentUser();
  const notes = user ? getDoc(user.id, "notes") : null;

  // Two independent requests, so they go together rather than one waiting on the other.
  // quotes() checks for the key itself and sends nothing without one.
  const [result, plan] = await Promise.all([
    quotes(list),
    mock || hasKey() ? account() : Promise.resolve(null),
  ]);
  const rows = "rows" in result ? result.rows : null;
  const failure = "failure" in result ? result.failure : null;

  const priced = rows?.filter(isAvailable) ?? [];
  const asOf =
    priced.length > 0 ? Math.max(...priced.map((r) => r.timestamp)) : null;

  return (
    <div className="min-h-screen bg-zinc-50 px-6 py-10 font-sans text-zinc-900 dark:bg-zinc-950 dark:text-zinc-100 sm:py-14">
      <main className="mx-auto flex w-full max-w-2xl flex-col gap-10">
        <header className="flex flex-col gap-1">
          <Nav here="/" />
          <h1 className="mt-4 text-lg font-semibold tracking-tight">
            Before the open
          </h1>
          <p className="text-sm text-zinc-600 dark:text-zinc-400">
            Your tickers, your key, fetched on the server.
          </p>
        </header>

        {mock && <MockMode />}

        {failure?.kind === "no-key" && <NoKey />}

        {failure && failure.kind !== "no-key" && (
          <CallFailed failure={failure} />
        )}

        {/* No wrapping section with a hidden "Watchlist" heading: the h1 above already
            says it and the table carries its own caption, so that made three announcements
            of the same word for anyone listening. */}
        {rows !== null && rows.length > 0 && (
          <Alerts fired={firedAlerts(RULES, rows)} ruleCount={RULES.length} />
        )}

        {rows !== null && rows.length > 0 && (
          <NotesProvider initial={notes} signedIn={user !== null}>
            <SortedWatchlist rows={rows} order={list} />
            <NotesStatus />
          </NotesProvider>
        )}

        {rows !== null && rows.length > 0 && (
          <UserLine user={user} />
        )}

        {added.length > 0 && (
          // Added names cost a call each on every load, so each can be taken off here.
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-zinc-600 dark:text-zinc-400">
            <span>Added from the screen:</span>
            {added.map((t) => (
              <form key={t} action={removeFromWatchlist.bind(null, t)}>
                <span className="text-zinc-900 dark:text-zinc-100">{t}</span>{" "}
                <button type="submit" className="underline underline-offset-2">
                  remove
                </button>
              </form>
            ))}
          </div>
        )}

        {rows !== null && rows.length === 0 && (
          // Empty is a state the learner caused, so it names the file that caused it
          // rather than rendering a bare table with nothing under the headings.
          <p className="text-sm text-zinc-600 dark:text-zinc-400">
            Your watchlist is empty. Add tickers in{" "}
            <Code>src/lib/watchlist.ts</Code>.
          </p>
        )}

        {/* Out of quota is the one failure where the meter is the explanation, so it
            stays on screen beside the message. */}
        {((rows !== null && rows.length > 0) || failure?.kind === "quota") && (
          <div className="grid gap-8 border-t border-zinc-200 pt-8 dark:border-zinc-800 sm:grid-cols-2">
            {rows !== null && (
              <Freshness ageMinutes={ageMinutes(rows)} asOf={asOf} />
            )}
            <WallMeter
              account={plan}
              pageCalls={pageLoadCalls(list)}
              mock={mock}
            />
          </div>
        )}

        <footer className="flex flex-col gap-3 border-t border-zinc-200 pt-8 text-sm text-zinc-600 dark:border-zinc-800 dark:text-zinc-400">
          <p>
            Edit <Code>src/lib/watchlist.ts</Code> for your tickers, and{" "}
            <Code>src/app/page.tsx</Code> for everything else. The key is read
            in exactly one place, <Code>src/lib/eodhd.ts</Code>, and never
            reaches the browser. Any market request you add in the browser
            goes through <Code>/api/proxy/*</Code>.
          </p>
          <p className="text-xs text-zinc-500 dark:text-zinc-400">
            Educational starter. Not investment advice. Market data by EODHD.
          </p>
        </footer>
      </main>
    </div>
  );
}
