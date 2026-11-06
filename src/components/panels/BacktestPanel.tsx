import { buyAndHold } from "@/lib/backtest/baseline";
import { backtest } from "@/lib/backtest/engine";
import { maxDrawdown, totalReturn } from "@/lib/backtest/metrics";
import { signedPercent } from "@/lib/format";
import { type BacktestConfig, parseBacktestConfig } from "@/lib/layout";
import type { PanelDef, PanelProps } from "@/lib/panels";

/**
 * The backtest as a panel: the rule run over the history it is handed, against buy and hold
 * on the same bars and costs. A computation over history, so it costs one request for the
 * bars and nothing to re-run.
 */
function BacktestPanelView({ config, data }: PanelProps<BacktestConfig>) {
  const bars = data.bars?.rows ?? [];
  if (bars.length <= config.slow) {
    return (
      <p className="text-zinc-600 dark:text-zinc-400">
        Not enough history for a {config.slow}-day average: {bars.length} bars.
      </p>
    );
  }
  const run = backtest(bars, config);
  const control = buyAndHold(bars.slice(config.slow - 1), config.costBps + config.slippageBps);
  const pct = (f: number) => signedPercent(f * 100);
  const first = run.dates[0];
  const last = run.dates[run.dates.length - 1];
  return (
    <div className="flex flex-col gap-2">
      <dl className="grid grid-cols-2 gap-3 tabular-nums sm:grid-cols-4">
        <Stat label="Strategy, net" value={pct(totalReturn(run.net))} />
        <Stat label="Buy and hold, net" value={pct(totalReturn(control.net))} />
        <Stat label="Trades" value={String(run.trades.length)} />
        <Stat label="Max drawdown" value={pct(maxDrawdown(run.net))} />
      </dl>
      <p className="text-xs text-zinc-500 dark:text-zinc-400">
        {config.symbol}, {config.fast}/{config.slow}, {first} to {last}, net of{" "}
        {config.costBps} bps + {config.slippageBps} bps a trade. A historical
        simulation, not advice.{" "}
        <a href="/backtest" className="underline underline-offset-2">
          The full backtest
        </a>
      </p>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col">
      <dt className="text-xs text-zinc-500 dark:text-zinc-400">{label}</dt>
      <dd className="font-medium">{value}</dd>
    </div>
  );
}

export const BacktestPanel: PanelDef<BacktestConfig> = {
  parse: parseBacktestConfig,
  dataNeeds: (config) => ({ quotes: [], eod: config.symbol }),
  Component: BacktestPanelView,
};
