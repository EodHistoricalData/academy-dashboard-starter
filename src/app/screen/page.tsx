import { Code, CallFailed, MockMode, NoKey } from "@/components/Notices";
import { WallMeter } from "@/components/WallMeter";
import { hasKey, isMock } from "@/lib/eodhd";
import { account } from "@/lib/quotes";
import {
  MY_SCREEN,
  screen,
  screenAsOf,
  screenCalls,
  type ScreenRow,
} from "@/lib/screens";

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
      <main className="mx-auto flex w-full max-w-3xl flex-col gap-10">
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

        {rows !== null && rows.length === 0 && (
          <p className="text-sm text-zinc-600 dark:text-zinc-400">
            Nothing matches these filters.
          </p>
        )}

        {rows !== null && rows.length > 0 && (
          <section className="flex flex-col gap-3">
            <p className="text-xs text-zinc-600 dark:text-zinc-400">
              As of {asOf}, the last completed session, not live prices.
              Earnings and yield are as old as each company’s latest filing.
              Loss-making companies are excluded by the earnings filter.
            </p>
            <ScreenTable rows={rows} />
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

function ScreenTable({ rows }: { rows: ScreenRow[] }) {
  return (
    <table className="w-full border-collapse text-sm tabular-nums">
      <caption className="sr-only">
        Companies matching the screen, largest first.
      </caption>
      <thead>
        <tr className="border-b border-zinc-200 text-xs font-medium uppercase tracking-wide text-zinc-500 dark:border-zinc-800 dark:text-zinc-400">
          <th scope="col" className="py-2 text-left">Code</th>
          <th scope="col" className="py-2 text-left">Name</th>
          <th scope="col" className="py-2 text-right">Close</th>
          <th scope="col" className="py-2 text-right">1d</th>
          <th scope="col" className="py-2 text-right">Market cap</th>
          <th scope="col" className="py-2 text-right">Yield</th>
          <th scope="col" className="py-2 pl-4 text-left">Sector</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((r) => (
          <tr
            key={r.code}
            className="border-b border-zinc-100 last:border-0 dark:border-zinc-900"
          >
            <th scope="row" className="py-2 text-left font-medium">
              {r.code}
            </th>
            <td className="py-2 text-left text-zinc-600 dark:text-zinc-400">
              {r.name}
            </td>
            <td className="py-2 text-right">{r.adjusted_close.toFixed(2)}</td>
            <td className="py-2 text-right">
              {r.refund_1d_p === null
                ? "—"
                : `${r.refund_1d_p > 0 ? "+" : r.refund_1d_p < 0 ? "−" : ""}${Math.abs(r.refund_1d_p).toFixed(2)}%`}
            </td>
            <td className="py-2 text-right">
              {r.market_capitalization.toLocaleString("en-US")}
            </td>
            <td className="py-2 text-right">
              {/* dividend_yield is a fraction: 0.0002 is 0.02%. */}
              {r.dividend_yield === null
                ? "—"
                : `${(r.dividend_yield * 100).toFixed(2)}%`}
            </td>
            <td className="py-2 pl-4 text-left text-zinc-600 dark:text-zinc-400">
              {r.sector ?? "—"}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
