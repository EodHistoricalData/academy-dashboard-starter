# Plan: my watchlist

## Purpose

A page I open at 7am, before the US open, that tells me for the instruments I hold or
want to hold what moved since the last close and by how much, so I know which ones to
read about before the market opens.

## Data, per thing on screen

| On screen | The question | Endpoint |
|---|---|---|
| Last price | What is it trading at now? | `/real-time/{ticker}` |
| Change since yesterday | How far did it move? | same call, `change` and `change_p` |
| Data age | How old is that price? | same call, `timestamp` |
| Calls used today | How close am I to the limit? | `/user` (free, read on the server) |

## Not building

- User accounts or a login.
- A database. The list is a file in the repo.
- Charts. Not even a sparkline yet.
- Alerts that push to my phone.
- A search box for adding tickers. I find a ticker once with `/search` and paste it in.
- Notes that sync between devices: they stay in this browser for now.

## Added in unit 3

- A sort I choose (as written, change %, volume) that survives a reload.
- A note per ticker: why I am watching it. Kept in this browser, never in git.
- One threshold rule, checked when the page loads and said to be checked only then.

## The wall, in my numbers

```
Cost per view:            7 calls (one per ticker; reading the meter is free)
Views my allowance buys:  2 per day (20 calls / 7, rounded down)
My data age:              7 days on the fixtures; live, measure it in market hours,
                          an hour after the close and on a weekend
What I cannot build:      a page I can leave open that keeps itself current
```

My routine is about 15 views a day: 105 calls, five times the free allowance. A page that
refreshes once a minute through a 6.5-hour session is 390 views, 2,730 calls. And the MSFT
rule fires as late as the data is old, whatever I spend.

## Done

Deployed at a URL, showing my tickers with live-ish prices and change, readable on my
phone, without my API key appearing anywhere in the browser: no request to `eodhd.com`
in the network tab, and `npm run check:leak` green.

### Checked at the end of course 1

- Deployed at a URL: not on this copy. Once it is, `node scripts/check-network.mjs <url>`
  stands in for the network tab.
- My tickers with live-ish prices and change: met, plus a sort, a note per ticker and one
  rule.
- Readable on my phone: met at 390px wide; notes are a desk feature, hidden there.
- No key in the browser: met. `npm run check:leak` is green, and the network check is
  clean against a local build.

Next: a screen that narrows a whole market to the few names worth adding to this list.

## Riskiest unknown

The API key must never reach the browser. Every market request goes through the
server-side proxy, and nothing reads the key outside `src/lib/eodhd.ts`.

## Course 2: the rebuild into a screener

Purpose: a page that narrows the US market to the twenty biggest profitable companies, so
I know which names are worth reading about. It finds what matches my filters; it does not
judge them.

**Survives untouched** (market-tool code, not watchlist code):
`src/lib/eodhd.ts`, `src/lib/proxy.ts`, `src/app/api/proxy/[...path]/route.ts`,
`src/lib/cost.ts`, `src/lib/mock.ts`, `src/app/api/usage/route.ts`,
`src/components/WallMeter.tsx`, `src/lib/failure.ts`, `scripts/`, `.githooks/`, the CI
workflow, and their tests.

**Generalises:** the table (`src/components/Watchlist.tsx`): same behaviour, different
columns and rows. The fetch-check-narrow pattern inside `src/lib/quotes.ts`, which the
screener needs too. `src/lib/rows.ts` (shape check at the boundary) as a pattern.

**New:** the universe, filters, an ordering, saved screens: `src/lib/screens.ts`, a
`/screen` page, a screener fixture.

**Dies** (in the screener; the watchlist keeps them): notes (`NoteField.tsx`,
`notes.ts`), threshold rules (`rules.ts`, `Alerts.tsx`), the manual sort
(`SortedWatchlist.tsx`, `sort.ts`), `Freshness.tsx`'s live-quote bands. They belong to
instruments I chose; a result set that changes on every run has no place for them.
`src/lib/watchlist.ts` stays the watchlist's own.

### Universe

Common stock on US exchanges. Counted from `/exchange-symbol-list/US`, barely a third of
"the US market" is common stock; funds, ETFs, indices, warrants and units are out, and so
is preferred stock: I screen on earnings per share, which a preferred share does not have.

The screener has no instrument-type filter I can rely on, so the screen itself keeps the
others out: `earnings_share > 0` drops anything that reports no earnings (funds, indices),
and it also drops loss-making companies, which I accept and say on the page.

### The breadth wall, in my numbers

```
Cost per screen attempt:    5 calls (one /screener request; the meter is free)
Attempts in a real session: 20
Sessions my allowance buys: 1 per week (20 calls a day, 140 a week; a session is 100)
Instruments I can see:      18,012 common stocks of 51,215 US instruments, one exchange
What I cannot screen:       anything outside US exchanges, and a morning of exploring
```

The first half of the wall throttles thinking: four attempts spend a free day. The second
half no number of calls fixes: London and Frankfurt are not in this screen at all, and the
answer does not say so. The counts are from the course's own count of
`/exchange-symbol-list/US`; this copy runs on fixtures and did not count.

### What felt awkward shipping the two together (the brief for course 4)

- The screener's codes come without the exchange (`NVDA`); the watchlist wants `NVDA.US`.
  The join has to add the suffix, and gets it from the row's `exchange`.
- The watchlist's list is a file, so a button cannot add to it. Names from the screen live
  in a cookie beside it: two homes for one list, and only the cookie's can be removed from
  the page.
- Notes, saved screens and the shortlist are three separate browser-storage keys with the
  same three rules. One store would be one set of rules.
- Every added name is a call on every watchlist load. The cap of ten is a cost decision
  made in code; I would rather see it on the page before I click.


## Course 3: a backtester beside the two tools

The one honest sentence, written before any code: *Under a cost of 10 basis points a
trade and fills at the next day's open, on one year of SPY.US daily bars (adjusted close,
EODHD, pulled once and cached), a rule stated on 6 November 2026 — hold SPY while its
20-day average is above its 50-day — would have produced this sequence of results.*

The rule was chosen from the course's example, not from looking at a chart of SPY. That is
what lets "stated in advance" stay in the sentence.

It is a historical simulation. Nothing it prints is advice.

### The defaults, chosen from theory and run once

Fast 20, slow 50, 10 bps a trade: the rule's textbook form, set before any result. First
run, on the fixture year (window 2026-01-13 to 2026-10-30, where the 50-day average first
exists): **net +4.64%, 3 trades, 61% of the time in the market**. Buy and hold on the same
window and costs: +23.72%.

This number stays. Anything found later by changing the parameters is compared with it,
not written over it, and the run log in `.cache/runs.jsonl` counts the attempts.

### Unit 3: the defaults again, with the honest fill

Same rule, filled at the next open with 5 bps of slippage on top of the 10 bps cost: **net
+4.67%**, against +4.64% at the signal close. On this year the overnight gaps happened to
go the rule's way; the point is that it is a different number for a stated reason, not a
better one. The median gap on the fill bars is 17 bps, larger than the 10 bps of cost.
Costs and slippage took 17% of the gross gain; at 25 bps a trade the result is still
positive.

Universe: SPY.US alone. The course counted 18,012 live US common stocks against 32,854
delisted (2026-08-25); a stock-picking version of this rule would have to include the dead
and say so. A single index fund has them inside it instead.

### Unit 4: the split, predicted before it is run

Split by date before touching anything: in-sample 2025-10-31 to the bar at 70% of the year,
out-of-sample the rest. Tune 15 pairs (fast 10–30, slow 40–60) in-sample only, then run
the winner once.

Prediction, written before the out-of-sample run: the in-sample winner will beat the
20/50 defaults in-sample, and out-of-sample it will make between −2% and +3% net,
below buy and hold on the same stretch.

Result: in-sample (to 2026-07-15) the winner was 20/40 at +14.03% net, against +6.61% for
the 20/50 defaults on the same stretch. Run once out-of-sample (2026-07-16 to 2026-10-30):
**+0.46% net**, against +2.39% for buy and hold. Inside the prediction. Fifteen sets were
tried in-sample, and the report says so.

The defaults' longest time under water: 91 trading days, 2026-03-24 to 2026-08-03. Would I
have kept running the rule through four months below its peak, while buy and hold was
making new highs? Probably not, which is a result in itself.

### The history wall, in my numbers

```
History available:   2025-10-31 to 2026-10-30   (251 bars, invented: mock mode;
                     the free plan reaches back one year)
Regimes in sample:   none: invented prices belong to no history
Regimes NOT tested:  2008, 2020, 2022, and every rate cycle before this window
```

The "everything against 2015-onward" comparison cannot be run here: all of it is after
2015. The drawdown and time under water above describe this year, not the rule.

## Course 4: one cockpit for the three tools

### State

Where each piece lives today, and where it belongs once the three share one page.

- Sort order of the watchlist (localStorage `watchlist-sort-v1`): panel-local. Only the
  watchlist reads it, and nothing breaks if another device sorts differently.
- Collapsed or expanded panels: panel-local. Nobody else cares.
- Saved screens (localStorage `screens-v1`): persisted. They are criteria I come back to;
  lesson 2 moves them to the server.
- Shortlist (localStorage `shortlist-v1`): persisted, for the same reason.
- Notes per ticker (localStorage `watchlist-notes-v1`): persisted. Personal, and wanted on
  every device.
- Watchlist tickers (`src/lib/watchlist.ts` and the `watchlist-added-v1` cookie):
  persisted. Two homes for one list, from course 2; the cockpit reads both.
- Threshold rules (`src/lib/rules.ts`): persisted. Unit 3 makes them documents.
- Backtest parameters (the address on `/backtest`) and the run log (`.cache/runs.jsonl`):
  persisted, on disk; the parameters become a panel's config.
- Screen filters (the address on `/screen`): shared once a screen is a panel, persisted when
  saved.
- Selected instrument: shared. Does not exist yet: three tools, three meanings of "selected".
- Quotes and their age: shared. Fetched per page today; one owner from lesson 3.

### Rebuild

- **Survives**: the proxy and its allowlist, `src/lib/market.ts`, `src/lib/failure.ts`,
  the cost table, the key scan and the hooks, the screener's filter checks, the backtest
  engine and its honesty tests.
- **Generalises**: `DataTable`, which gets a third caller; the storage rules (version the
  key, guard the parse, key by name) become one versioned document per key on the server.
- **New**: a document store with a version per document, sign-in for the one owner, one
  market store that owns fetching, a layout document, panels, an alert evaluator.
- **Dies**: three page shells each fetching for itself, and any code that assumed a tool
  owned the whole screen. The three pages stay as they are for now; the cockpit is built
  beside them at `/dashboard`.
