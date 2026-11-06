import { DataTable } from "@/components/DataTable";
import { Code, CallFailed, MockMode, NoKey } from "@/components/Notices";
import { WallMeter } from "@/components/WallMeter";
import { hasKey, isMock } from "@/lib/eodhd";
import { account } from "@/lib/quotes";
import { SCREEN_COLUMNS } from "@/lib/screen-columns";
import { MY_SCREEN, screen, screenAsOf, screenCalls } from "@/lib/screens";

// A screen runs on the server, on every load, through eodhdFetch: the key never leaves it.
export const dynamic = "force-dynamic";

export const metadata = { title: "Screen · Market tool starter" };

export default async function ScreenPage() {
  const mock = isMock();
  const [result, plan] = await Promise.all([
    screen(MY_SCREEN),
    mock || hasKey() ? account() : Promise.resolve(null),
  ]);
  const rows = "rows" in result ? result.rows : null;
  const asOf = rows ? screenAsOf(rows) : null;

  return (
    <div className="min-h-screen bg-zinc-50 px-6 py-10 font-sans text-zinc-900 dark:bg-zinc-950 dark:text-zinc-100 sm:py-14">
      <main className="mx-auto flex w-full max-w-4xl flex-col gap-10">
        <header className="flex flex-col gap-1">
          <h1 className="text-lg font-semibold tracking-tight">Screen</h1>
          <p className="text-sm text-zinc-600 dark:text-zinc-400">
            Market cap over $10B · earnings per share above zero · US exchanges
            · largest first, top 20. These match my filters; that is all they
            are.
          </p>
        </header>

        {mock && <MockMode />}

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
                Loss-making companies are excluded by the earnings filter.
              </p>
            )}
            <DataTable
              columns={SCREEN_COLUMNS}
              rows={rows}
              rowKey={(r) => r.code}
              caption="Companies matching the screen, largest first."
              empty="Nothing matches these filters."
            />
          </section>
        )}

        <div className="border-t border-zinc-200 pt-8 dark:border-zinc-800 sm:w-1/2">
          <WallMeter
            account={plan}
            pageCalls={screenCalls(MY_SCREEN)}
            mock={mock}
            basis="one screener request, however many rows"
          />
        </div>

        <footer className="text-xs text-zinc-500 dark:text-zinc-400">
          The screen is defined in <Code>src/lib/screens.ts</Code>. Educational
          starter. Not investment advice. Market data by EODHD.
        </footer>
      </main>
    </div>
  );
}
