import { EquityChart } from "@/components/EquityChart";
import { Nav } from "@/components/Nav";
import { CallFailed, Code, MockMode, NoKey } from "@/components/Notices";
import { WallMeter } from "@/components/WallMeter";
import { buyAndHold } from "@/lib/backtest/baseline";
import { type Bar, loadCandles } from "@/lib/backtest/candles";
import { maxDrawdown, totalReturn } from "@/lib/backtest/metrics";
import { estimateCalls } from "@/lib/cost";
import { hasKey, isMock } from "@/lib/eodhd";
import { signedPercent } from "@/lib/format";
import { account } from "@/lib/quotes";

export const dynamic = "force-dynamic";

export const metadata = { title: "Backtest · Market tool starter" };

const SYMBOL = "SPY.US";
/** Unit 1 draws the cost line at zero: the habit starts before the number does. */
const COST_BPS = 0;

export default async function BacktestPage() {
  const mock = isMock();
  const [candles, plan] = await Promise.all([
    loadCandles(SYMBOL),
    mock || hasKey() ? account() : Promise.resolve(null),
  ]);

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
          <Baseline bars={candles.bars} pulledAt={candles.pulledAt} />
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

function Baseline({ bars, pulledAt }: { bars: Bar[]; pulledAt: string }) {
  const run = buyAndHold(bars, COST_BPS);
  const first = bars[0]?.date;
  const last = bars[bars.length - 1]?.date;

  return (
    <section className="flex flex-col gap-4">
      <h2 className="text-xs font-medium uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
        Buy and hold, the control
      </h2>
      <EquityChart
        dates={run.dates}
        caption={`Buy and hold ${SYMBOL}, gross and net of ${COST_BPS} bps a trade.`}
        series={[
          {
            label: "Buy and hold, gross",
            values: run.gross,
            stroke: "stroke-zinc-400",
            dashed: true,
          },
          {
            label: `Buy and hold, net of ${COST_BPS} bps a trade`,
            values: run.net,
            stroke: "stroke-zinc-900 dark:stroke-zinc-100",
          },
        ]}
      />
      <dl className="grid grid-cols-3 gap-4 text-sm tabular-nums">
        <Stat
          label={`Total return, ${first} to ${last}`}
          value={signedPercent(totalReturn(run.net) * 100)}
        />
        <Stat
          label="Max drawdown"
          value={signedPercent(maxDrawdown(run.net) * 100)}
        />
        <Stat label="Trades" value={String(run.trades)} />
      </dl>
      <p className="text-xs text-zinc-500 dark:text-zinc-400">
        {bars.length} daily bars of <Code>adjusted_close</Code>, pulled{" "}
        {pulledAt.slice(0, 10)}. Costs: {COST_BPS} bps a trade, drawn even at
        zero.
      </p>
    </section>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-1">
      <dt className="text-xs text-zinc-500 dark:text-zinc-400">{label}</dt>
      <dd className="text-base font-medium">{value}</dd>
    </div>
  );
}
