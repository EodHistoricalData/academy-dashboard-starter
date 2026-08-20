import { Freshness } from "@/components/Freshness";
import { WallMeter } from "@/components/WallMeter";
import { Watchlist } from "@/components/Watchlist";
import { account, ageMinutes, quotes } from "@/lib/quotes";
import { WATCHLIST } from "@/lib/watchlist";

// Server-rendered on every request, never prerendered: a page built at deploy time would
// show prices from deploy time. The whole point is that these numbers are yours and current.
export const dynamic = "force-dynamic";

export default async function Home() {
  const hasKey = Boolean(process.env.EODHD_API_KEY);

  // Two independent calls, so they go together rather than one waiting on the other.
  const [rows, plan] = await Promise.all([
    hasKey ? quotes(WATCHLIST) : Promise.resolve(null),
    hasKey ? account() : Promise.resolve(null),
  ]);

  const asOf =
    rows && rows.length > 0 ? Math.max(...rows.map((r) => r.timestamp)) : null;

  return (
    <div className="min-h-screen bg-zinc-50 px-6 py-10 font-sans text-zinc-900 dark:bg-zinc-950 dark:text-zinc-100 sm:py-14">
      <main className="mx-auto flex w-full max-w-2xl flex-col gap-10">
        <header className="flex flex-col gap-1">
          <h1 className="text-lg font-semibold tracking-tight">Watchlist</h1>
          <p className="text-sm text-zinc-600 dark:text-zinc-400">
            Your tickers, your key, fetched on the server.
          </p>
        </header>

        {!hasKey && <NoKey />}

        {hasKey && rows === null && <CallFailed />}

        {/* No wrapping section with a hidden "Watchlist" heading: the h1 above already
            says it and the table carries its own caption, so that made three announcements
            of the same word for anyone listening. */}
        {rows !== null && rows.length > 0 && <Watchlist rows={rows} />}

        {rows !== null && rows.length === 0 && (
          // Empty is a state the learner caused, so it names the file that caused it
          // rather than rendering a bare table with nothing under the headings.
          <p className="text-sm text-zinc-600 dark:text-zinc-400">
            Your watchlist is empty. Add tickers in{" "}
            <Code>src/lib/watchlist.ts</Code>.
          </p>
        )}

        {rows !== null && rows.length > 0 && (
          <div className="grid gap-8 border-t border-zinc-200 pt-8 dark:border-zinc-800 sm:grid-cols-2">
            <Freshness ageMinutes={ageMinutes(rows)} asOf={asOf} />
            <WallMeter account={plan} />
          </div>
        )}

        <footer className="flex flex-col gap-3 border-t border-zinc-200 pt-8 text-sm text-zinc-600 dark:border-zinc-800 dark:text-zinc-400">
          <p>
            Edit <Code>src/lib/watchlist.ts</Code> for your tickers, and{" "}
            <Code>src/app/page.tsx</Code> for everything else. The key is read
            in exactly one place, <Code>src/lib/eodhd.ts</Code>, and never
            reaches the browser. Every market call goes through{" "}
            <Code>/api/proxy/*</Code>.
          </p>
          <p className="text-xs text-zinc-500 dark:text-zinc-400">
            Educational starter. Not investment advice. Market data by EODHD.
          </p>
        </footer>
      </main>
    </div>
  );
}

function NoKey() {
  return (
    <section className="rounded-lg border border-amber-300 bg-amber-50 p-4 text-sm dark:border-amber-900/60 dark:bg-amber-950/30">
      <h2 className="font-semibold text-amber-900 dark:text-amber-200">
        No key found
      </h2>
      <ol className="mt-2 list-decimal space-y-1 pl-5 text-amber-900 dark:text-amber-200">
        <li>
          Copy <Code>.env.example</Code> to <Code>.env.local</Code>.
        </li>
        <li>
          Put your key in <Code>EODHD_API_KEY</Code>. A free one is at{" "}
          <a
            href="https://eodhd.com"
            target="_blank"
            rel="noopener noreferrer"
            className="underline underline-offset-2"
          >
            eodhd.com
          </a>
          .
        </li>
        <li>Restart the dev server.</li>
      </ol>
      <p className="mt-3 text-amber-900 dark:text-amber-200">
        Deployed on Vercel? Set the same variable in the project&apos;s
        environment settings and redeploy.
      </p>
    </section>
  );
}

function CallFailed() {
  return (
    // A key that is present but rejected, or a ticker that does not exist, must say so.
    // A blank page here is the one outcome that teaches nothing.
    <section className="rounded-lg border border-zinc-300 bg-white p-4 text-sm dark:border-zinc-700 dark:bg-zinc-900">
      <h2 className="font-semibold">
        The key is set, but the call did not return data
      </h2>
      <ul className="mt-2 list-disc space-y-1 pl-5 text-zinc-600 dark:text-zinc-400">
        <li>Check the key is valid and has not been revoked.</li>
        <li>
          Check every ticker in <Code>src/lib/watchlist.ts</Code>. One bad
          symbol is enough.
        </li>
        <li>
          Check today&apos;s quota. Call <Code>/api/usage</Code> directly to see
          it.
        </li>
      </ul>
    </section>
  );
}

function Code({ children }: { children: React.ReactNode }) {
  return (
    <code className="rounded bg-zinc-100 px-1 py-0.5 font-mono text-[0.85em] text-zinc-900 dark:bg-zinc-800 dark:text-zinc-100">
      {children}
    </code>
  );
}
