# Course 3 prompts: Backtest Strategies

The prompts the lessons of this course ask you to paste, in lesson order, copied from the
lessons themselves. Start Claude Code in this folder with `EODHD_MOCK=1` in `.env.local`,
paste one prompt at a time, and read the plan before you say yes. Each lesson says what a
good answer changes and how to check it yourself.

The reference state at the end of each unit is on the branch `ref/backtest-strategies/u<unit>` of this
repository: `git fetch upstream`, then `git diff upstream/ref/backtest-strategies/u1`.

## 1. What a backtest can prove, and what it cannot (unit 1)

Put your sentence at the end of `PLAN.md` under a heading of its own, with a line saying the results will be a historical simulation and not advice. Then start Claude Code in the starter, press Shift+Tab until the status bar says plan mode on, and paste:

```
Read the backtest section at the end of PLAN.md. Do not edit any file.
For each part of my sentence - the assumptions, the data, "stated in
advance", "would have" - tell me what is still vague enough that two
people could build different backtests from it. Then tell me what
answering this cost in API calls. It should be none.
```

## 2. Load candles through the proxy you already have (unit 1)

Put `EODHD_MOCK=1` in `.env.local` and restart. Plan mode on, then paste:

```
Plan first and wait for my yes. Add loadCandles(symbol) in
src/lib/backtest/candles.ts. It asks through marketGet in
src/lib/market.ts, the transport the watchlist and the screen share,
for eod/{symbol} with no date range: the whole history in one request.
Narrow the answer to bars that carry all seven fields, and throw if
they are not oldest-first. Keep the answer on disk under .cache/eod/
with the date it was pulled, read that file when it exists, never
read or write it in mock mode, and add .cache/ to .gitignore. A 404
arrives with a plain-text body: make marketGet keep a body that is not
JSON as text, and have loadCandles return it as a message. Before you
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
Compare with a tolerance. No request and no other file. Run npm test,
then show me the diff.
```

## 4. Draw the baseline first, with costs already visible (unit 1)

Mock mode on, plan mode on:

```
Plan first. Add a page at src/app/backtest/page.tsx and a Backtest link
in src/components/Nav.tsx. The page loads SPY on the US exchange with
loadCandles and draws buy and hold: buyAndHold(bars, costBps) in
src/lib/backtest/baseline.ts compounds adjusted returns from 1 into a
gross curve, and a net one that pays costBps on the purchase and on the
sale at the end. Draw both as one server-rendered SVG in
src/components/EquityChart.tsx, no chart library, and draw the net line
even at 0 bps, which is where the page starts. Under the chart: total
return with the first and last dates, maximum drawdown against the
running peak in src/lib/backtest/metrics.ts, and the trade count. Fewer
than two bars shows a sentence, not a chart. Tell me what the page costs
live before you wire it. Tests first in tests/baseline.test.ts. Run npm
test and npm run check:leak, then show me the diff.
```

## 5. State a rule that cannot see the future (unit 2)

Write `tests/leak.test.ts` yourself, from the section above: 120 synthetic bars, the signal at bar 80, bars 81 to 120 changed, and an assertion that the signal at bar 80 is not null before you compare it. Run `npm test` and watch it fail — there is no `signal.ts` yet. Stage it with `git add tests/leak.test.ts`, so git holds the version you wrote. Mock mode on, plan mode on:

```
Plan first. Make tests/leak.test.ts pass without editing it. Add
src/lib/backtest/signal.ts with sma(bars, i, n), over a window that
ends at bar i and throws "short window at bar i" when it holds fewer
than n bars, and signals(bars, fast, slow): one forward pass over
adjusted closes, null until the slow average exists, then whether the
fast average is above the slow. Assert oldest-first at the boundary
with assertOldestFirst from candles.ts. No request. Run npm test and
show me the output, then the diff.
```

## 6. Parameters, defaults, and the number you will regret (unit 2)

Mock mode on, plan mode on:

```
Plan first. Lift the rule's numbers into src/lib/backtest/params.ts: a
Params type with fast, slow and costBps, DEFAULTS of 20, 50 and 10,
and parseParams(query), which checks fast, slow and cost from the
address - whole numbers, fast at least 2 and below slow, slow at most
200, cost from 0 to 100 - and names whatever it dropped, the way the
screen page does. The backtest page uses them in place of COST_BPS
and prints them. Add logRun() in src/lib/backtest/runlog.ts:
each live run appends one JSON line to .cache/runs.jsonl with the
date, the symbol, the first and last bar, the parameters and the
result so far - the share of bars the signal is on - unless a line
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
bar whose signal changed, and the return comes from adjusted closes.
A position still open on the last bar is closed there. Add
runStrategy(bars, params) in src/lib/backtest/strategy.ts, returning
the signals, the positions, the trades, a gross curve, and a net one
that pays costBps on every position change, the forced close on the
last bar included. On the page, draw the strategy beside buy and hold,
list the first ten trades, and add the total return and trade count
to the run log's result. Tests first in tests/positions.test.ts, with
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
maximum drawdown; add timeInMarket to src/lib/backtest/metrics.ts. Add
a neighbour table: the chosen pair and four neighbours (fast 2 either
side, slow 5 either side), on the same cached bars, all measured from
the latest start among the five, with the same four numbers. The
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
first: on flat prices, four position changes at 10 bps leave 0.999 to
the fourth power; a position held a hundred flat bars stays at 0.999
from its entry to its exit; the forced close on the last bar pays
like any exit. Fix the code only where a test fails. Under the
strategy, print what the costs took as a share of starting equity and
as a fraction of the gross return (n/a when the gross return is not
positive), and add a row of net returns at 0, 5, 10 and 25 bps on the
same cached bars, shown and not logged. No request. Run npm test, then
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
bars where the strategy traded, beside costBps. No request. Run npm
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

## 12. Survivorship, and the companies that are not in your list (unit 3)

This is the first lesson in the course that spends calls on purpose, so mock mode goes off and the price is named first. Plan mode on:

```
Plan first and wait for my yes. Before any request, tell me what each
one costs with estimateCalls() and the total. Through my proxy at
localhost:3000, count the US common stocks in the exchange symbol
list, live and then with delisted=1. Pick five delisted tickers from
different years, fetch each one's daily history through the proxy, and
for each tell me the date of its last bar and whether a code with the
same ISIN appears in either list. If a history comes back empty or
refused, say so and pick another. Change no code. Write the two counts
with today's date, one line per ticker, and a sentence on what this
means for a backtest on SPY into a Universe section in PLAN.md, then
show me the diff.
```

## 13. Measure drawdown properly (unit 4)

Work one short equity series out by hand first, and keep your answers: a curve of 1, 1.2, 0.9, 1.0, 1.3 is 25% deep and two bars under water. Mock mode on, plan mode on, and paste your series and answers under this:

```
Plan first. In src/lib/backtest/metrics.ts keep maxDrawdown against
the running peak, and add timeUnderWater(curve, dates): the longest run
of bars below a prior peak, with its first and last date, where a bar
back at the peak counts as recovered; and returnOverDrawdown: total
return divided by the size of the maximum drawdown. Print all three
under both curves, and shade the strategy's longest underwater stretch
on the chart. Tests first in tests/metrics.test.ts, on the series and
answers below, worked out by hand. No request. Run npm test, then show
me the diff.
```

## 14. In-sample, out-of-sample, and the honest way to tune (unit 4)

Mock mode on, plan mode on:

```
Plan first. Add SPLIT_DATE to src/lib/backtest/split.ts: the first
date 70% of the way through my history in .cache/eod/, or through the
mock year if I have no cache, worked out once now and written into
the code as a string, not recomputed when the history grows. Tell me
the date. The backtest page runs on the bars before it
by default. With oos=1 in the address it also runs the same parameters
from that date on, letting the averages warm up on the bars just
before it, and shows the two results side by side. Every out-of-sample
run goes into the run log marked oos, even a repeat, and the page
prints how many parameter sets the log holds and how many times I
looked out of sample. No request. Tests first in tests/split.test.ts.
Run npm test, then show me the diff.
```

## 15. The history wall (unit 4)

Mock mode on, plan mode on:

```
Plan first. Add a from parameter to the backtest page, read from the
address and checked like the others, that trims the cached bars
before the run, so a shorter window costs no request. Then, from my
history in .cache/eod/ only, tell me my earliest bar, my bar count,
and my strategy's maximum drawdown on all bars and from 2015-01-01.
Draft the three history lines at the end of PLAN.md (available,
regimes in sample, regimes not tested) from those numbers, and show me
the diff. I will edit the regimes myself.
```
