import type { Account } from "@/lib/quotes";

/**
 * Calls used today, against the daily limit.
 *
 * Present from the first minute on purpose. A limit you only meet by hitting it is a limit
 * that breaks your tool without warning, usually on the morning you finally rely on it.
 *
 * The bar is a fill, never a score: there is no "good" position on it. It exists so the
 * distance to the wall is visible at a glance, and the exact figures are written out
 * beside it because a bar alone cannot be read precisely or by a screen reader.
 */
export function WallMeter({
  account,
  pageCalls,
  mock,
}: {
  account: Account | null;
  /** What one load of this page spends; see pageLoadCalls in src/lib/quotes.ts. */
  pageCalls: number;
  mock: boolean;
}) {
  // The price of a reload, beside the balance it comes out of. "12 left" means little
  // until you know a reload costs 5.
  const cost = (
    <p className="text-xs tabular-nums text-zinc-600 dark:text-zinc-400">
      {mock
        ? `This load cost nothing. Live, it would cost ${calls(pageCalls)}.`
        : `Each load of this page costs ${calls(pageCalls)}: one per ticker.`}
    </p>
  );

  if (!account) {
    return (
      <div className="flex flex-col gap-2">
        <p className="text-xs text-zinc-500 dark:text-zinc-400">
          Could not read your plan. The watchlist above may still be working.
        </p>
        {cost}
      </div>
    );
  }

  const { used, dailyLimit, plan } = account;
  const known = used !== null && dailyLimit !== null && dailyLimit > 0;
  const share = known ? Math.min(1, used / dailyLimit) : 0;
  // Near, not "danger". Whether a fifth of a quota is a problem depends entirely on what
  // the tool does with the rest of the day, and this component does not know that.
  const near = known && share >= 0.8;

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-baseline justify-between gap-4">
        <h2 className="text-xs font-medium uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
          API calls today
        </h2>
        <p className="text-xs tabular-nums text-zinc-600 dark:text-zinc-400">
          plan{" "}
          <span className="font-medium text-zinc-900 dark:text-zinc-100">
            {plan}
          </span>
        </p>
      </div>

      {known ? (
        <>
          <div
            className="h-1.5 w-full overflow-hidden rounded-full bg-zinc-200 dark:bg-zinc-800"
            role="img"
            aria-label={`${used} of ${dailyLimit} daily API calls used`}
          >
            <div
              className={`h-full rounded-full ${
                near ? "bg-amber-500" : "bg-zinc-500 dark:bg-zinc-400"
              }`}
              style={{ width: `${Math.max(share * 100, 1)}%` }}
            />
          </div>
          <p className="text-xs tabular-nums text-zinc-600 dark:text-zinc-400">
            {used.toLocaleString("en-US")} of{" "}
            {dailyLimit.toLocaleString("en-US")} used
            {" · "}
            {(dailyLimit - used).toLocaleString("en-US")} left
          </p>
        </>
      ) : (
        <p className="text-xs text-zinc-600 dark:text-zinc-400">
          This plan did not report a daily limit.
        </p>
      )}
      {cost}
    </div>
  );
}

function calls(n: number): string {
  return `${n.toLocaleString("en-US")} ${n === 1 ? "call" : "calls"}`;
}
