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
