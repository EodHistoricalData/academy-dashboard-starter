import { EquityChart } from "@/components/EquityChart";
import { Nav } from "@/components/Nav";
import { CallFailed, Code, MockMode, NoKey } from "@/components/Notices";
import { WallMeter } from "@/components/WallMeter";
import { buyAndHold } from "@/lib/backtest/baseline";
import { type Bar, loadCandles } from "@/lib/backtest/candles";
import { backtest, DEFAULTS, type Params } from "@/lib/backtest/engine";
import { maxDrawdown, totalReturn } from "@/lib/backtest/metrics";
import { neighbours, paramsFrom } from "@/lib/backtest/params";
import { appendRun, paramSetsTried, readRuns } from "@/lib/backtest/runlog";
import { estimateCalls } from "@/lib/cost";
import { hasKey, isMock } from "@/lib/eodhd";
import { signedPercent } from "@/lib/format";
import { account } from "@/lib/quotes";

export const dynamic = "force-dynamic";

export const metadata = { title: "Backtest · Market tool starter" };

const SYMBOL = "SPY.US";

export default async function BacktestPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const params = paramsFrom(await searchParams);
  const mock = isMock();
  const [candles, plan] = await Promise.all([
    loadCandles(SYMBOL),
    mock || hasKey() ? account() : Promise.resolve(null),
  ]);

  let tried = 0;
  if ("bars" in candles) {
    // Every run is logged, automatically, before it is shown.
    const run = backtest(candles.bars, params);
    await appendRun({
      at: new Date().toISOString(),
      symbol: SYMBOL,
      params,
      netReturn: totalReturn(run.net),
      trades: run.trades.length,
    });
    tried = paramSetsTried(await readRuns(), SYMBOL);
  }

  return (
    <div className="min-h-screen bg-zinc-50 px-6 py-10 font-sans text-zinc-900 dark:bg-zinc-950 dark:text-zinc-100 sm:py-14">
      <main className="mx-auto flex w-full max-w-3xl flex-col gap-10">
        <header className="flex flex-col gap-1">
          <Nav here="/backtest" />
          <h1 className="mt-4 text-lg font-semibold tracking-tight">Backtest</h1>
          <p className="text-sm text-zinc-600 dark:text-zinc-400">
            A historical simulation on {SYMBOL}, not advice. Under these
            assumptions, on this data, a rule stated in advance would have
            produced the results below. Nobody traded them.
          </p>
        </header>

        {mock && <MockMode />}

        {"failure" in candles &&
          (candles.failure.kind === "no-key" ? (
            <NoKey />
          ) : (
            <CallFailed failure={candles.failure} />
          ))}

        {"notFound" in candles && (
          <section className="rounded-lg border border-zinc-300 bg-white p-4 text-sm dark:border-zinc-700 dark:bg-zinc-900">
            <h2 className="font-semibold">No history for {SYMBOL}</h2>
            <p className="mt-1 text-zinc-600 dark:text-zinc-400">
              EODHD answered: {candles.notFound} Check the ticker, including
              its exchange suffix.
            </p>
          </section>
        )}

        {"bars" in candles && (
          <Results
            bars={candles.bars}
            pulledAt={candles.pulledAt}
            params={params}
            tried={tried}
          />
        )}

        <div className="border-t border-zinc-200 pt-8 dark:border-zinc-800 sm:w-1/2">
          <WallMeter
            account={plan}
            pageCalls={estimateCalls(`eod/${SYMBOL}`) ?? 0}
            mock={mock}
            basis="one /eod request for the whole history, then nothing until the cache is deleted"
          />
        </div>
      </main>
    </div>
  );
}

function Results({
  bars,
  pulledAt,
  params,
  tried,
}: {
  bars: Bar[];
  pulledAt: string;
  params: Params;
  tried: number;
}) {
  const run = backtest(bars, params);
  // The control starts on the strategy's first bar, with the same costs and column: a
  // control that started earlier would hand the warm-up period to one side.
  const control = buyAndHold(bars.slice(params.slow - 1), params.costBps);
  const first = run.dates[0];
  const last = run.dates[run.dates.length - 1];

  return (
    <section className="flex flex-col gap-8">
      <div className="flex flex-col gap-2 text-sm">
        <h2 className="text-xs font-medium uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
          The rule
        </h2>
        <p>
          Hold {SYMBOL} from the next bar while its {params.fast}-day average
          of the adjusted close is above its {params.slow}-day average;
          otherwise hold nothing. {params.costBps} bps a trade, filled at the
          signal bar’s close.
        </p>
        <p className="text-xs text-zinc-500 dark:text-zinc-400">
          Parameters <Code>{JSON.stringify(params)}</Code>
          {params.fast === DEFAULTS.fast &&
          params.slow === DEFAULTS.slow &&
          params.costBps === DEFAULTS.costBps
            ? " — the defaults chosen before any result."
            : " — not the defaults; the default run stays in PLAN.md."}{" "}
          Parameter sets tried on {SYMBOL} so far: {tried}.
        </p>
      </div>

      <EquityChart
        dates={run.dates}
        caption={`Strategy and buy and hold on ${SYMBOL}, ${first} to ${last}.`}
        series={[
          {
            label: "Strategy, gross",
            values: run.gross,
            stroke: "stroke-sky-400",
            dashed: true,
          },
          {
            label: `Strategy, net of ${params.costBps} bps a trade`,
            values: run.net,
            stroke: "stroke-sky-700 dark:stroke-sky-300",
          },
          {
            label: `Buy and hold, net of ${params.costBps} bps a trade`,
            values: control.net,
            stroke: "stroke-zinc-500",
          },
        ]}
      />

      <table className="w-full text-sm tabular-nums">
        <caption className="sr-only">Four numbers per line, same window.</caption>
        <thead>
          <tr className="border-b border-zinc-200 text-left text-xs uppercase tracking-wide text-zinc-500 dark:border-zinc-800 dark:text-zinc-400">
            <th className="py-2 font-medium">
              {first} to {last}
            </th>
            <th className="py-2 text-right font-medium">Total return</th>
            <th className="py-2 text-right font-medium">Time in market</th>
            <th className="py-2 text-right font-medium">Trades</th>
            <th className="py-2 text-right font-medium">Max drawdown</th>
          </tr>
        </thead>
        <tbody>
          <tr className="border-b border-zinc-100 dark:border-zinc-900">
            <th scope="row" className="py-2 text-left font-medium">
              Strategy, net
            </th>
            <td className="py-2 text-right">{pct(totalReturn(run.net))}</td>
            <td className="py-2 text-right">{(run.timeInMarket * 100).toFixed(0)}%</td>
            <td className="py-2 text-right">{run.trades.length}</td>
            <td className="py-2 text-right">{pct(maxDrawdown(run.net))}</td>
          </tr>
          <tr>
            <th scope="row" className="py-2 text-left font-medium">
              Buy and hold, net
            </th>
            <td className="py-2 text-right">{pct(totalReturn(control.net))}</td>
            <td className="py-2 text-right">100%</td>
            <td className="py-2 text-right">{control.trades}</td>
            <td className="py-2 text-right">{pct(maxDrawdown(control.net))}</td>
          </tr>
        </tbody>
      </table>

      <div className="flex flex-col gap-2">
        <h2 className="text-xs font-medium uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
          Trades, first ten
        </h2>
        <table className="w-full text-sm tabular-nums">
          <thead>
            <tr className="border-b border-zinc-200 text-left text-xs uppercase tracking-wide text-zinc-500 dark:border-zinc-800 dark:text-zinc-400">
              <th className="py-2 font-medium">In</th>
              <th className="py-2 text-right font-medium">Price</th>
              <th className="py-2 pl-6 font-medium">Out</th>
              <th className="py-2 text-right font-medium">Price</th>
              <th className="py-2 text-right font-medium">Return, net</th>
            </tr>
          </thead>
          <tbody>
            {run.trades.slice(0, 10).map((t) => (
              <tr
                key={t.entryDate}
                className="border-b border-zinc-100 last:border-0 dark:border-zinc-900"
              >
                <td className="py-1.5">{t.entryDate}</td>
                <td className="py-1.5 text-right">{t.entryPrice.toFixed(2)}</td>
                <td className="py-1.5 pl-6">{t.exitDate}</td>
                <td className="py-1.5 text-right">{t.exitPrice.toFixed(2)}</td>
                <td className="py-1.5 text-right">{pct(t.ret)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <p className="text-xs text-zinc-500 dark:text-zinc-400">
          Prices are raw closes, what printed; returns are on the adjusted
          column, so a dividend inside a trade is counted.
        </p>
      </div>

      <div className="flex flex-col gap-2">
        <h2 className="text-xs font-medium uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
          Neighbours
        </h2>
        <table className="w-full text-sm tabular-nums">
          <thead>
            <tr className="border-b border-zinc-200 text-left text-xs uppercase tracking-wide text-zinc-500 dark:border-zinc-800 dark:text-zinc-400">
              <th className="py-2 font-medium">Fast / slow</th>
              <th className="py-2 text-right font-medium">Return, net</th>
              <th className="py-2 text-right font-medium">Trades</th>
            </tr>
          </thead>
          <tbody>
            {neighbours(params).map((p, i) => {
              const r = backtest(bars, p);
              return (
                <tr
                  key={`${p.fast}-${p.slow}`}
                  className="border-b border-zinc-100 last:border-0 dark:border-zinc-900"
                >
                  <td className="py-1.5">
                    {p.fast} / {p.slow}
                    {i === 0 ? " (chosen)" : ""}
                  </td>
                  <td className="py-1.5 text-right">{pct(totalReturn(r.net))}</td>
                  <td className="py-1.5 text-right">{r.trades.length}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
        <p className="text-xs text-zinc-500 dark:text-zinc-400">
          A plateau is what you want. A chosen value that wins while its
          neighbours lose found noise. Neighbour runs are not logged: they
          check a result, they are not attempts at one.
        </p>
      </div>

      <p className="text-xs text-zinc-500 dark:text-zinc-400">
        {bars.length} daily bars of <Code>adjusted_close</Code>, pulled{" "}
        {pulledAt.slice(0, 10)}. Change the rule in the address:{" "}
        <Code>{"?fast=20&slow=50&costBps=10"}</Code>.
      </p>
    </section>
  );
}

function pct(fraction: number): string {
  return signedPercent(fraction * 100);
}
