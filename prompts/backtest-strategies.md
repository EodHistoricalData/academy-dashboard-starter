<!-- Generated from the lessons of Backtest Strategies by scripts/sync_starter_prompts.py in the academy repository. Edit the lesson and run the script; an edit here is overwritten. -->

# Backtest Strategies prompts

The prompts the lessons of this course ask you to paste, in lesson order, copied from the lessons themselves with the lines that say where and how to paste them. Start your agent in this folder, with `EODHD_MOCK=1` in `.env.local` unless the lesson says otherwise, paste one prompt at a time, and read the plan before you say yes. Each lesson says what a good answer changes and how to check it yourself.

The reference state at the end of each unit is on the branch `ref/backtest-strategies/u<unit>` of this repository. If you cloned the starter, it is your `origin`: `git fetch origin`, then `git diff origin/ref/backtest-strategies/u1`. If your copy points at a repository of your own, [README.md](README.md) says how to add the starter as `upstream`.

## 1. What a backtest can prove, and what it cannot (unit 1)

Put your sentence at the end of `PLAN.md` under a heading of its own, with a line saying the results will be a historical simulation and not advice. Then start your agent in the starter, press Shift+Tab until plan mode shows under the prompt, and paste:

```
Read the backtest section at the end of PLAN.md. Do not edit any file.
For each part of my sentence - the assumptions, the data, "stated in
advance", "would have" - tell me what is still vague enough that two
people could build different backtests from it. Then tell me what
answering this cost in API calls. It should be none.
```

## 2. Load candles through the proxy you already have (unit 1)

Mock mode on (`EODHD_MOCK=1` in `.env.local`; if you set it in the screener course it is already there, so change nothing) and restart. Plan mode on, then paste:

```
Plan first and wait for my yes. Add loadCandles(symbol) in
src/lib/backtest/candles.ts. It asks through the transport function
in src/lib/market.ts that the watchlist and the screen share (find
it there, whatever it is called), for eod/{symbol} with no date
range: the whole history in one request.
Narrow the answer to bars that carry all seven fields (export their type
as Bar: date, open, high, low, close, adjusted_close, volume), and throw if
they are not oldest-first, in an exported assertOldestFirst(bars) that
later code can reuse. Keep the answer on disk under .cache/eod/
with the date it was pulled, read that file when it exists, never
read or write it in mock mode, and add .cache/ to .gitignore. A 404
arrives with a plain-text body: make that transport keep a body that
is not JSON as text, and have loadCandles return it as a message. Before you
write the request, tell me what one live load costs with
estimateCalls(). Tests first in tests/candles.test.ts, with fetch
stubbed: a 404 whose body is "Ticker Not Found.", and the fixture read
in mock mode. Run npm test and npm run check:leak, then show me the diff.
```

## 3. Turn prices into returns, before any strategy exists (unit 1)

Mock mode on, plan mode on. Paste this, and under it the five bars and the split row from this lesson:

```
Plan first. Add src/lib/backtest/returns.ts: dailyReturns(bars, column),
where column is "adjusted_close" or "close" and the first bar has no
return; compound(returns), an equity curve from 1 that multiplies;
largestMoves(returns, n); and parseSplit for the splits endpoint's
string ratio. Tests first in tests/returns.test.ts, on the five bars
and the split row below, as literals: for 2020-08-31, +3.4% on adjusted
and -74.2% on close, as I read them off the lesson, and one case where
adding returns instead of multiplying them would give the wrong curve.
Compare with a tolerance. Every expected value is a literal I give you,
never one computed with the code's own arithmetic. No request and no
other file. Run npm test,
then show me the diff.
```

## 4. Draw the baseline first, with costs already visible (unit 1)

Mock mode on, plan mode on:

```
Plan first. Add a page at src/app/backtest/page.tsx and a Backtest link
next to the existing page links (create a small shared nav if the pages
have none). The page loads SPY on the US exchange with
loadCandles and draws buy and hold: buyAndHold(bars, costBps) in
src/lib/backtest/baseline.ts compounds adjusted returns from 1 into a
gross curve, and a net one that pays costBps on the purchase and on the
sale at the end. Draw both as one server-rendered SVG in
src/components/EquityChart.tsx, no chart library, and draw the net line
even at 0 bps, which is where the page starts. Under the chart: total
return with the first and last dates, maximum drawdown against the
running peak in src/lib/backtest/metrics.ts, and the trade count (buy and
hold is one round trip, so 1). Show the net total return with the gross
one beside it. Fewer
than two bars shows a sentence, not a chart. Tell me what the page costs
live before you wire it. Tests first in tests/baseline.test.ts. Run npm
test and npm run check:leak, then show me the diff.
```

## 5. State a rule that cannot see the future (unit 2)

Create `tests/leak.test.ts` yourself, from the template below: 120 synthetic bars, the signal at bar 80, bars 81 to 120 changed, and an assertion that the signal at bar 80 is not null before you compare it. The test is the part that has to be yours, so type it in or paste it, then read each line until you can say what it asserts. The bar generator is plain arithmetic, and the template passes `npm run typecheck`:

```ts
// tests/leak.test.ts
import { expect, test } from "vitest";
import type { Bar } from "@/lib/backtest/candles";
import { sma, signals } from "@/lib/backtest/signal";

function makeBars(count: number): Bar[] {
  const bars: Bar[] = [];
  for (let i = 0; i < count; i++) {
    const price = 100 + i * 0.3 + Math.sin(i / 5) * 8;
    bars.push({
      date: new Date(Date.UTC(2025, 0, 1 + i)).toISOString().slice(0, 10),
      open: price, high: price + 1, low: price - 1, close: price,
      adjusted_close: price, volume: 1_000_000,
    });
  }
  return bars;
}

test("the signal at bar 80 does not move when bars 81 to 120 change", () => {
  const bars = makeBars(120);
  const at80 = (b: Bar[]) => [sma(b, 80, 20), sma(b, 80, 50), signals(b, 20, 50)[80]];
  const before = at80(bars);
  expect(before[2]).not.toBeNull();            // a null cannot move, so it proves nothing
  const changed = bars.map((b, i) => (i > 80 ? { ...b, adjusted_close: 1 } : b));
  expect(at80(changed)).toEqual(before);
});
```

Run `npm test` and watch it fail — there is no `signal.ts` yet. Stage it with `git add tests/leak.test.ts`, so git holds the version you wrote. Mock mode on, plan mode on:

```
Plan first. Make tests/leak.test.ts pass without editing it. Add
src/lib/backtest/signal.ts with sma(bars, i, n), over a window that
ends at bar i and throws "short window at bar i" unless it holds
exactly n bars, and signals(bars, fast, slow): one forward pass over
adjusted closes, null until the slow average exists, then whether the
fast average is above the slow. Assert oldest-first at the boundary
with assertOldestFirst from candles.ts (add it there and export it if it
is not exported yet). No request. Run npm test and
show me the output, then the diff.
```

## 6. Parameters, defaults, and the number you will regret (unit 2)

Mock mode on, plan mode on:

```
Plan first. Lift the rule's numbers into src/lib/backtest/params.ts: a
Params type with fast, slow and costBps, DEFAULTS of 20, 50 and 10,
and parseParams(query), which checks fast, slow and cost from the
address - whole numbers, fast at least 2 and below slow, slow at most
200, cost from 0 to 100 - drops a bad value, runs the default in its
place, and names what it dropped. The backtest page uses them in
place of the cost it held until now (a constant, or a parameter if
it already reads one from the address) and prints them, and says plainly that fast and slow do not change the
curve yet (the next lesson draws the rule). Add logRun() in src/lib/backtest/runlog.ts:
each live run appends one JSON line to .cache/runs.jsonl with the
date, the symbol, the first and last bar, the parameters and the
result so far - the share of all bars in the series, warm-up
included, on which the signal is on - unless a line
for the same parameters on the same bars is already there. Mock runs
are not logged. No request. Tests first. Run npm test, then show me
the diff.
```

## 7. Entries and exits, as a state machine (unit 2)

Mock mode on, plan mode on. Paste this with the two-row trace from the lesson under it:

```
Plan first. Add src/lib/backtest/positions.ts: positions(signals), one
per bar, where a signal on bar i changes the position on bar i+1 and a
null signal means no position; and trades(bars, positions), written
as four named transitions (staying flat, entering, holding, exiting),
not one expression. A trade records entry date and price, exit date
and price, and its return. For now it fills at the raw close of the
signal bar i (the bar whose signal changed; the first day held is bar
i+1), and the return comes from adjusted closes.
A position still open on the last bar is closed there. Add
runStrategy(bars, params) in src/lib/backtest/strategy.ts, returning
the signals, the positions, the trades, a gross curve, and a net one
that pays costBps on every position change, the forced close on the
last bar included. On the page, draw the strategy's gross and net lines
beside buy and hold's on the same chart (update any older test that
counted two lines), list up to the first ten trades, and add the net
total return and trade count to the run log's result. Tests first in tests/positions.test.ts, with
the trace below as literals. No request. Run npm test, then show me
the diff.
```

## 8. Compare against buy-and-hold, honestly (unit 2)

Mock mode on, plan mode on:

```
Plan first. On the backtest page, start buy and hold on the bar where
the slow average first exists, which is where the strategy starts,
rebase both curves to 1 there, charge costBps on both, and use
adjusted closes for both. Under each curve print four numbers: total
return, time in market as a share of bars, number of trades, and
maximum drawdown; add timeInMarket to src/lib/backtest/metrics.ts,
the share of bars on which a position is held, so buy and hold,
holding on every bar from its first, shows 100%. Add
a neighbour table: the chosen pair and four neighbours (fast 2 either
side, slow 5 either side), on the same cached bars, all measured from
the latest start among the five, with the same four numbers (print that
start date above the table, and say that the chosen pair's row can differ
from the numbers under its own curve because their start dates differ). The
neighbours are shown, not logged: you did not choose them. No request.
Tests first in tests/benchmark.test.ts. Run npm test, then show me the
diff.
```

## 9. Transaction costs, and why the default is on (unit 3)

Mock mode on, plan mode on:

```
Plan first. Read how runStrategy in src/lib/backtest/strategy.ts
charges costs and tell me, before changing anything, whether it
charges at every position change, compounding, and never for holding
or as a total taken off at the end. Then write tests/costs.test.ts
first: on flat prices, with the positions given directly (the 20/50 rule
never signals on flat prices), four position changes at 10 bps leave
0.999 to
the fourth power; a position held a hundred flat bars stays at 0.999
from its entry to its exit; the forced close on the last bar pays
like any exit. Fix the code only where a test fails. Under the
strategy, print what the costs took as a share of starting equity and
as a fraction of the gross return (n/a when the gross return is not
positive; keep the word gross on the page for it), and add a row of net
returns at 0, 5, 10 and 25 bps on the
same cached bars, shown and not logged. No request. If runStrategy
cannot take positions directly, split out the part that does and tell
me. Run npm test, then
show me the diff.
```

## 10. Slippage, or the price you did not get (unit 3)

Mock mode on, plan mode on:

```
Plan first. Add two parameters to Params, read from the address like
the others: fill, "next-open" or "signal-close", defaulting to
next-open, and slippageBps, defaulting to 5 and always against me: a
buy fills higher, a sale lower. Fills use raw prices; a next-open fill
trades at the open of the bar after the signal. Returns still come
from adjusted closes, with that open scaled by its bar's adjusted to
raw ratio. Record each fill's bar and its printed price before
slippage, and write tests/fills.test.ts first: every printed fill
lies inside its bar's raw low-to-high. Print the median absolute
overnight gap, previous close to next open in basis points, over the
bars where the strategy traded, beside costBps. Apply the same fill and
slippage to buy and hold, the neighbour table and the cost row, so every
comparison stays like for like. No request. Run npm
test, then show me the diff.
```

## 11. Find the leaking bar (unit 3)

Mock mode on, plan mode on. The first prompt builds the tests:

```
Plan first. Write tests/honesty.test.ts on synthetic bars, with no
request. Future mutation: change every bar after k to nonsense, and
every signal and position at or before k is identical. Truncation:
run on bars 0 to k and on all bars, and the signal and position series
through k match; not the trades, since the short run closes its open
position at k by construction. The fill-range test in
tests/fills.test.ts is the third. Then add shuffleCheck(bars, params,
seed) in src/lib/backtest/shuffle.ts: the strategy on twenty seeded
permutations of the daily returns, dates kept, shown on the page as a
median beside the real result, with no pass mark. Run npm test, then
show me the diff.
```

The second is the attack, and it must change nothing:

```
Read src/lib/backtest/ and tests/. Find every way this code could be
using information from the future. For each, name the file and line
and say which of my tests would catch it. Do not change any file.
```

## 12. Survivorship, and the companies that are not in your list (unit 3)

This is the first lesson in the course that spends calls on purpose, so mock mode goes off and the price is named first. Plan mode on:

```
Plan first and wait for my yes. Before any request, tell me what each
one costs with estimateCalls() and the total. Through my proxy at
localhost:3000, count the US common stocks in the exchange symbol
list, live and then with delisted=1. Pick five delisted tickers from
different years (on a free key, only ones delisted within the past year), fetch each one's daily history through the proxy, and
for each tell me the date of its last bar and whether a code with the
same ISIN appears in either list. If a history comes back empty or
refused, say so and pick another. Change no code. Write the two counts
with today's date, one line per ticker, and a sentence on what this
means for a backtest on SPY into a new "Universe (backtest)" section in
PLAN.md (the screener course left a Universe section there; leave it as
it is), then show me the diff. If any request answers 403 or 402,
make no further request and write the section from these figures
instead, saying they are a lesson's and not mine: US common stocks on
2026-08-25, 18,012 live and 32,854 delisted; SIVB, SVB Financial
Group, last bar 106.04, then traded as SIVBQ with the same ISIN,
whose first session with volume, 28 March 2023, closed at 0.40.
```

## 13. Build it twice, and make the two agree (unit 3)

Mock mode on, plan mode on. Start a new session for the first prompt:

```
Plan first. Do not open src/lib/backtest/strategy.ts or tests/ for
this. Add twin(bars, params) in src/lib/backtest/twin.ts, returning
dates, gross and net from the first bar where the slow average exists.
The unit held at a bar's close is 1 when the signal at the close
before was true, and 0 on that first bar. Each bar is a night,
previous close to this open, and a day, this open to this close, both
on adjusted prices: the open times that bar's adjusted_close / close.
With fill "next-open" the night earns its move if a unit was held at
the previous close, and the day if one is held at this close. With
"signal-close" the whole bar earns its move if a unit is held at this
close. Each change of position pays (costBps + slippageBps) / 10000
once, and a unit still held at the last bar pays it once more. Use
signals() from signal.ts and nothing else from src/lib/backtest. No
test yet. Show me the diff.
```

The second, back in your usual session:

```
Plan first. Add tests/twin.test.ts on the SPY fixture: backtest()
and twin() give the same dates and, on every bar, gross and net
within a relative 1e-9, on four runs: the defaults, costs and
slippage off, fill "signal-close", and fast 5 with slow 10. Assert
that each run trades at least twice and that one still holds at the
last bar. Then a split: on a copy of the fixture with every raw open,
high, low and close before a bar the default run holds through
multiplied by 4, adjusted_close untouched, both engines give the
original curves. Change nothing in strategy.ts. Run npm test, then
show me the diff.
```

## 14. Audit the adjusted column against what the company did (unit 3)

Mock mode on, plan mode on. Paste this, and under it the Apple rows from this lesson and the two record rows below:

```
Plan first. Add src/lib/backtest/adjustment.ts with
auditAdjustments(bars, dividends, splits): the days on which
adjusted_close / close steps by something other than the record says,
which is 1 / (1 - D / previous close) on an ex-dividend day with D
the unadjustedValue, the ratio on a split day, and 1 on any other
day. An event dated on a day with no bar is checked on the next bar,
and a bar with a zero close is a problem. Allow 1e-4 plus 1e-4
divided by each of the two adjusted closes. Add toDividends and
toSplits for the two endpoints' bodies, using parseSplit. Tests
first in tests/adjustment.test.ts on the rows below, as literals:
nothing reported as given, the split day reported when the split is
left out, the dividend day reported when D is read from value, and
2020-08-31 reported when 2020-08-27 and 08-28 come from the older
pull. Run npm test, then show me the diff.
```

```json
{"date":"2020-08-07","value":0.205,"unadjustedValue":0.82,"currency":"USD"}
{"date":"2020-08-31","split":"4.000000/1.000000"}
```

The older pull is the returns lesson's: 2020-08-27 at 500.04 and 121.1519, 2020-08-28 at 499.23 and 120.9557.

The second puts it on the page:

```
Plan first. Add src/lib/backtest/actions.ts: loadActions(symbol,
pulledAt) fetches div/{symbol} and splits/{symbol} through
marketGet, caches both in .cache/actions with the pulledAt of the
history they were fetched with, and fetches again when the history
was pulled again. Add fixtures/div/SPY.US.json with the four
dividends below and fixtures/splits/SPY.US.json as []. On the
backtest page, print the audit under the results, and put a mismatch
at the top. Before writing the fetch, tell me what the page costs
per load.
```

## 15. Measure drawdown properly (unit 4)

Work one short equity series out by hand first, and keep your answers: a curve of 1, 1.2, 0.9, 1.0, 1.3 is 25% deep and two bars under water, and its return over drawdown is 1.2 (a 30% return over a 25% hole). Mock mode on, plan mode on, and paste your series and answers under this:

```
Plan first. In src/lib/backtest/metrics.ts keep the maximum drawdown
against the running peak that is already there, and add
timeUnderWater(curve, dates): the longest run
of bars below a prior peak, with its first and last date, where a bar
back at the peak counts as recovered; and returnOverDrawdown: total
return divided by the size of the maximum drawdown. Print all three
under both curves, and shade the strategy's longest underwater stretch
on the chart. Tests first in tests/metrics.test.ts, on the series and
answers below, worked out by hand. No request. Run npm test, then show
me the diff.
```

## 16. In-sample, out-of-sample, and the honest way to tune (unit 4)

Mock mode on, plan mode on:

```
Plan first. Add SPLIT_DATE to src/lib/backtest/split.ts: the first
date 70% of the way through my history in .cache/eod/, or through the
mock year if I have no cache, worked out once now and written into
the code as a string, not recomputed when the history grows. Tell me
the date. The backtest page runs on the bars before it
by default. With oos=1 in the address it also runs the same parameters
from that date on, letting the averages warm up on the bars just
before it, and shows the two results side by side. Every live
out-of-sample run goes into the run log marked oos, even a repeat;
mock runs stay out of the log, as before. The page
prints how many parameter sets the log holds and how many times I
looked out of sample. No request. Tests first in tests/split.test.ts.
Run npm test, then show me the diff.
```

## 17. The history wall (unit 4)

Mock mode on, plan mode on:

```
Plan first. Add a from parameter to the backtest page, read from the
address and checked like the others, that trims the cached bars
before the run, so a shorter window costs no request. Then, from my
history in .cache/eod/, or from the mock year's fixture if there is no
cache (say which), tell me my earliest bar, my bar count, and my
strategy's maximum drawdown on the bars before SPLIT_DATE, all of
them and from 2015-01-01; stay in sample, so this is not another
look out of sample.
Draft the three history lines at the end of PLAN.md (available,
regimes in sample, regimes not tested) from those numbers, and show me
the diff. I will edit the regimes myself.
```

## 18. Publish the report, and what the exam checks (unit 4)

The agent cannot see this lesson, so the prompt carries the report's contents. Mock mode on, plan mode on, and paste:

```
Plan first. Add a report to the backtest page: a link "Download the
report" to /backtest/report, which answers with one Markdown file
generated by code from the run it describes, using the same address
parameters (fast, slow, cost, slippage, fill) and the same cached
history as the page. Downloading it makes no API request.
The file starts with a title, then a quoted line saying it is a
historical simulation, not advice, and that the author is not a licensed
adviser. Then these sections, in this order:
- Claim: the one honest sentence from PLAN.md with every blank filled
   from the run (cost, slippage, fill rule, bar count, first and last
   date, the date the rule was stated, the rule itself).
- Parameters: the whole parameters object as JSON.
- Data: symbol, first and last bar, bar count, which close column
   returns use, source and date pulled. If the bars are the mock
   fixture, say so, and say that they are invented prices, not market
   data.
- Assumptions: fill rule, cost and slippage in bps, the universe and
   what it leaves out, one unit held or none.
- Results: strategy and buy and hold side by side, on the same bars and
   costs: gross and net return, cost as a share of gross, maximum
   drawdown, time under water, return over drawdown, trades, time in
   market.
- Robustness: the in-sample result; the out-of-sample result as the
   run log's last oos line recorded it, never run again for the
   report, because generating a report is not a look (if the log
   holds no oos line, say it has not been run); the
   neighbour-parameter table; the number of parameter sets the run
   log holds for this symbol, not counting the oos lines; and the
   number of looks out of sample.
- Tests: the future-mutation, truncation and fill-range checks, run
   on this data when the report is generated, each marked passed or
   FAILED, not copied from the last npm test. Then the shuffle
   check's median beside the real result, as two numbers with no
   pass mark: it is not a leak test.
- Not tested: the history window and the regimes outside it, walk-forward
   over several periods, other instruments and a universe with delisted
   names, and whether anyone would have followed the rule.
Keep the date the rule was stated in one constant. Tests first in
tests/report.test.ts: the sections appear in this order, the first lines
say historical simulation, not advice, the parameters and the number of
attempts are printed, mock prices are labelled as invented, and the
text contains no FAILED. Before writing, read the honest sentence in
PLAN.md and tell me if it describes a different rule, cost or fill than
the code runs. Run npm test, typecheck and check:leak, then show me the
diff.
```
