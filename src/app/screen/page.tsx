import { DataTable } from "@/components/DataTable";
import { Nav } from "@/components/Nav";
import {
  CallFailed,
  Code,
  MockMode,
  NoKey,
  StoreNotice,
  UserLine,
} from "@/components/Notices";
import { SavedScreens } from "@/components/SavedScreens";
import { ShortlistPanel, ShortlistProvider } from "@/components/Shortlist";
import { ScreenForm } from "@/components/ScreenForm";
import { WallMeter } from "@/components/WallMeter";
import { hasKey, isMock } from "@/lib/eodhd";
import { account } from "@/lib/quotes";
import { myTickers } from "@/lib/my-tickers";
import { readDoc } from "@/lib/store";
import { currentUser } from "@/lib/user";
import {
  SCREEN_COLUMNS,
  shortlistColumn,
  watchlistColumn,
} from "@/lib/screen-columns";
import { DEFAULT_SORT, parseFilterParam, safeSort, toTriples } from "@/lib/filters";
import {
  MY_FILTERS,
  PAGE_LIMIT,
  type Screen,
  screen,
  screenAsOf,
  screenPageCalls,
} from "@/lib/screens";

// A screen runs on the server, on every load, through eodhdFetch: the key never leaves it.
export const dynamic = "force-dynamic";

export const metadata = { title: "Screen · Market tool starter" };

export default async function ScreenPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const query = await searchParams;
  // The address is input from a stranger: every filter in it is checked, and what fails is
  // dropped and named below rather than quietly fixed.
  const { filters, dropped } =
    typeof query.f === "string"
      ? parseFilterParam(query.f)
      : { filters: MY_FILTERS, dropped: [] };
  const sort = safeSort(query.sort) ?? DEFAULT_SORT;
  const current: Screen = { filters: toTriples(filters), sort, limit: PAGE_LIMIT };

  const mock = isMock();
  const { list: watching } = await myTickers();
  const user = await currentUser();
  const none = { doc: null, error: null };
  const screensRead = user ? readDoc(user.id, "saved-screens") : none;
  const shortlistRead = user ? readDoc(user.id, "shortlist") : none;
  const savedScreens = screensRead.doc;
  const shortlist = shortlistRead.doc;
  const [result, plan] = await Promise.all([
    screen(current),
    mock || hasKey() ? account() : Promise.resolve(null),
  ]);
  const rows = "rows" in result ? result.rows : null;
  const asOf = rows ? screenAsOf(rows) : null;

  return (
    <div className="min-h-screen bg-zinc-50 px-6 py-10 font-sans text-zinc-900 dark:bg-zinc-950 dark:text-zinc-100 sm:py-14">
      <main className="mx-auto flex w-full max-w-6xl flex-col gap-10">
        <header className="flex flex-col gap-1">
          <Nav here="/screen" />
          <h1 className="mt-4 text-lg font-semibold tracking-tight">Screen</h1>
          <p className="text-sm text-zinc-600 dark:text-zinc-400">
            US exchanges, top {PAGE_LIMIT} by {sort}. These match the filters;
            that is all they are.
          </p>
        </header>

        {mock && <MockMode />}

        <ScreenForm key={`${query.f}|${sort}`} filters={filters} sort={sort} />

        <UserLine user={user} />
        <StoreNotice error={screensRead.error ?? shortlistRead.error} />

        {/* One shortlist document for the panel and the cells in the table. */}
        <ShortlistProvider initial={shortlist} signedIn={user !== null}>
          <div className="grid gap-8 sm:grid-cols-2">
            <SavedScreens
              filters={filters}
              sort={sort}
              initial={savedScreens}
              signedIn={user !== null}
            />
            <ShortlistPanel />
          </div>

          {dropped.length > 0 && (
            <p className="text-sm text-amber-900 dark:text-amber-200">
              Dropped from the address, not on this screener’s list:{" "}
              {dropped.map((d, i) => (
                <span key={d}>
                  {i > 0 && ", "}
                  <Code>{d}</Code>
                </span>
              ))}
            </p>
          )}

          {"failure" in result &&
            (result.failure.kind === "no-key" ? (
              <NoKey />
            ) : (
              <CallFailed failure={result.failure} />
            ))}

          {"invalid" in result && (
            // The screener says which filter it refused. That path is worth more than any
            // "something went wrong", so it is shown as it came.
            <section className="rounded-lg border border-zinc-300 bg-white p-4 text-sm dark:border-zinc-700 dark:bg-zinc-900">
              <h2 className="font-semibold">The screener refused a filter</h2>
              <ul className="mt-2 list-disc space-y-1 pl-5 text-zinc-600 dark:text-zinc-400">
                {result.invalid.map((m) => (
                  <li key={m}>{m}</li>
                ))}
              </ul>
            </section>
          )}

          {rows !== null && (
            <section className="flex flex-col gap-3">
              {asOf && (
                <p className="text-xs text-zinc-600 dark:text-zinc-400">
                  As of {asOf}, the last completed session, not live prices.
                  Earnings and yield are as old as each company’s latest filing.
                  A company missing a field a filter uses is excluded, the same as
                  one that fails it.
                </p>
              )}
              <DataTable
                columns={[...SCREEN_COLUMNS, shortlistColumn, watchlistColumn(watching)]}
                rows={rows}
                rowKey={(r) => r.code}
                caption="Companies matching the screen, largest first."
                empty="Nothing matches these filters."
              />
            </section>
          )}
        </ShortlistProvider>

        <div className="border-t border-zinc-200 pt-8 dark:border-zinc-800 sm:w-1/2">
          <WallMeter
            account={plan}
            pageCalls={screenPageCalls(current)}
            mock={mock}
            basis="one screener request, however many rows"
          />
        </div>

        <footer className="text-xs text-zinc-500 dark:text-zinc-400">
          The screen is defined in <Code>src/lib/screens.ts</Code>.
        </footer>
      </main>
    </div>
  );
}
