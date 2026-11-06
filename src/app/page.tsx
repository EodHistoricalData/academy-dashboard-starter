import { Freshness } from "@/components/Freshness";
import { WallMeter } from "@/components/WallMeter";
import { Watchlist } from "@/components/Watchlist";
import { hasKey, isMock } from "@/lib/eodhd";
import type { Failure } from "@/lib/failure";
import { account, ageMinutes, pageLoadCalls, quotes } from "@/lib/quotes";
import { isAvailable } from "@/lib/rows";
import { WATCHLIST } from "@/lib/watchlist";

// Server-rendered on every request, never prerendered: a page built at deploy time would
// show prices from deploy time. The whole point is that these numbers are yours and current.
export const dynamic = "force-dynamic";

export default async function Home() {
  const mock = isMock();

  // Two independent requests, so they go together rather than one waiting on the other.
  // quotes() checks for the key itself and sends nothing without one.
  const [result, plan] = await Promise.all([
    quotes(WATCHLIST),
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
          <h1 className="text-lg font-semibold tracking-tight">
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
        {rows !== null && rows.length > 0 && <Watchlist rows={rows} />}

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
              pageCalls={pageLoadCalls(WATCHLIST)}
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
      <p className="mt-3 text-amber-900 dark:text-amber-200">
        No key yet? Put <Code>EODHD_MOCK=1</Code> in <Code>.env.local</Code> to
        see the page on sample data.
      </p>
    </section>
  );
}

function MockMode() {
  return (
    // Said first and plainly: invented numbers that look live are worse than no numbers.
    <section className="rounded-lg border border-zinc-300 bg-white p-4 text-sm dark:border-zinc-700 dark:bg-zinc-900">
      <h2 className="font-semibold">Mock mode</h2>
      <p className="mt-1 text-zinc-600 dark:text-zinc-400">
        <Code>EODHD_MOCK</Code> is on. Everything below comes from the files in{" "}
        <Code>fixtures/</Code>: invented numbers in EODHD’s format, not market
        data. No API calls are spent. Remove the variable and restart to go live.
      </p>
    </section>
  );
}

function CallFailed({
  failure,
}: {
  failure: Exclude<Failure, { kind: "no-key" }>;
}) {
  const { title, steps } = explain(failure);
  return (
    // Each failure names itself and the next step. "Something went wrong" over all of
    // them sends you looking in the wrong place for an hour.
    <section className="rounded-lg border border-zinc-300 bg-white p-4 text-sm dark:border-zinc-700 dark:bg-zinc-900">
      <h2 className="font-semibold">{title}</h2>
      <ul className="mt-2 list-disc space-y-1 pl-5 text-zinc-600 dark:text-zinc-400">
        {steps.map((step, i) => (
          <li key={i}>{step}</li>
        ))}
      </ul>
    </section>
  );
}

function explain(failure: Exclude<Failure, { kind: "no-key" }>): {
  title: string;
  steps: React.ReactNode[];
} {
  switch (failure.kind) {
    case "rejected":
      return failure.status === 401
        ? {
            title: "EODHD rejected the key (401)",
            steps: [
              "The API answers the same way for a revoked key and a mistyped one.",
              <>
                Check <Code>EODHD_API_KEY</Code> in <Code>.env.local</Code>{" "}
                character by character, or in your host’s settings, then
                restart.
              </>,
            ],
          }
        : {
            title: "Your plan does not cover this request (403)",
            steps: [
              "The key works; one of the tickers is on an exchange or feed the plan does not include.",
              <>
                Remove tickers from <Code>src/lib/watchlist.ts</Code> one at a
                time to find which.
              </>,
            ],
          };
    case "quota":
      return {
        title: "Today’s API calls are spent (402)",
        steps: [
          "Nothing is broken. The count resets at midnight GMT, and retrying before then only fails again.",
          <>
            Put <Code>EODHD_MOCK=1</Code> in <Code>.env.local</Code> to keep
            working on fixtures meanwhile.
          </>,
        ],
      };
    case "rate-limit":
      return {
        title: "Too many requests in one minute (429)",
        steps: [
          `This clears by itself: wait ${failure.retryAfter ?? "60"} seconds and reload.`,
          "Something is probably fetching in a loop.",
        ],
      };
    case "unreachable":
      return {
        title:
          failure.status === null
            ? "Could not reach EODHD"
            : `EODHD answered ${failure.status}`,
        steps: [
          "The request failed, timed out after 15 seconds, or came back in a shape the page does not read.",
          "Check your connection and reload. If it persists, the API status is the next place to look.",
        ],
      };
  }
}

function Code({ children }: { children: React.ReactNode }) {
  return (
    <code className="rounded bg-zinc-100 px-1 py-0.5 font-mono text-[0.85em] text-zinc-900 dark:bg-zinc-800 dark:text-zinc-100">
      {children}
    </code>
  );
}
