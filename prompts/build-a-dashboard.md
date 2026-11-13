<!-- Generated from the lessons of Build a Dashboard by scripts/sync_starter_prompts.py in the academy repository. Edit the lesson and run the script; an edit here is overwritten. -->

# Build a Dashboard prompts

The prompts the lessons of this course ask you to paste, in lesson order, copied from the lessons themselves with the lines that say where and how to paste them. Start your agent in this folder, with `EODHD_MOCK=1` in `.env.local` unless the lesson says otherwise, paste one prompt at a time, and read the plan before you say yes. Each lesson says what a good answer changes and how to check it yourself.

The reference state at the end of each unit is on the branch `ref/build-a-dashboard/u<unit>` of this repository. If you cloned the starter, it is your `origin`: `git fetch origin`, then `git diff origin/ref/build-a-dashboard/u1`. If your copy points at a repository of your own, [README.md](README.md) says how to add the starter as `upstream`.

## 1. Three tools, one product — what composition costs (unit 1)

Mock mode on (`EODHD_MOCK=1` in `.env.local`), plan mode on, and paste:

```
Read the three tools in this repo: the watchlist (src/app/page.tsx and
what it imports), the screen page and the backtest page. List every piece
of state they keep: each localStorage key, each cookie, each constant a
person edits by hand, each value a component holds. For each one, say
where it lives today and which tier it belongs to once the three share a
dashboard, with a one-line reason. Decide the tier in this order:
persisted if it must outlive this browser (another device, cleared site
data), however many panels read it; otherwise shared if more than one
panel reads it; otherwise panel-local. Then draft a Rebuild section for
the cockpit under survives (kept as it is), generalises (kept, but now
serving more callers), new and dies. Add both at the end of PLAN.md as
"## State" and "## Rebuild", and change nothing else. Change no code,
make no request, and show me the diff before saving.
```

## 2. Move persistence off the browser (unit 1)

In the starter the watchlist itself is a file and a cookie; what lives in `localStorage` is the saved screens, the shortlist and the notes, all through `src/lib/stored.ts`. This prompt moves the saved screens. Moving the shortlist and the notes the same way, a commit each, is optional practice: our reference does it, and nothing later in the course depends on it. The sort order stays where it is, because it is panel-local.

Mock mode on, plan mode on, and paste:

```
Plan step 1 of moving the saved screens off the browser, and only step 1.
Add src/lib/store.ts: documents keyed by user and key, each with a
version integer, a payload and updatedAt, one table docs in SQLite
through Node's built-in node:sqlite, in .data/app.db, which git
ignores; the tests use ":memory:". The columns of docs are exactly
user_id, key, version, payload and updated_at. node:sqlite needs
Node 22.13 or newer, so raise engines in package.json to
">=22.13.0" with no upper limit, raise @types/node to ^22 to match,
run npm install so the lockfile follows, and add no type shim of
your own. putDoc takes the version the caller
read and refuses the write if it has moved, in one conditional UPDATE,
so two writes arriving together cannot both pass. Every function takes
the user first, and
src/lib/user.ts is the one place the current user comes from; until
there is a sign-in it returns the number 1, one owner. Add the
route src/app/api/store/[key]/route.ts: GET is 404 for a missing
document, PUT is 409 on a stale version, and only the keys I list exist; for now
the only key is screens-v1.
The saved-screens component reads the route and falls back to
localStorage only when the server has nothing; writes go to the server
and, until the fallback is removed, to localStorage too. Write
tests/store.test.ts first: a stale version is refused, and another
user's document is a 404. No upstream request. Run npm test, typecheck,
lint and check:leak, and show me the diff before committing.
```

## 3. One data layer for three panels (unit 1)

Mock mode on, plan mode on, and paste:

```
Plan a market store in a new src/lib/market-store.ts, made by a function
that takes the quote fetcher, the clock and a maxAge as parameters. Its
quotes(symbols) gathers every symbol asked for in the same tick into one
request for the union, keeps each row with its fetchedAt and serves it
again while it is younger than maxAge, and gives a second caller the
request already in flight. Add oldestTimestamp(rows). Write
tests/market-store.test.ts first with a fake fetcher that counts its
calls: two callers in one tick with overlapping symbols make one call for
the union, and asking again inside maxAge makes none. Then make the home
page's "as of" the oldest timestamp rather than the newest, and the age
printed beside it follow that same time. First, with
estimateCalls in src/lib/cost.ts, tell me what one home page load costs
now and after this change; it must not go up. Mock mode only. Run npm
test, typecheck, lint and check:leak, and show me the diff.
```

## 4. Panels as data, layouts as documents (unit 1)

Mock mode on, plan mode on, and paste:

```
Plan, then build, src/lib/layout.ts from these types:

type Panel = {
  id: string;
  type: "watchlist" | "screen" | "backtest" | "quote";
  title: string;
  config: unknown;   // validated per type, never trusted
  position: { x: number; y: number; w: number; h: number };
};
type Layout = { name: string; panels: Panel[]; version: number };

Add DEFAULT_LAYOUT: a watchlist, a screen and a backtest. Add parseLayout(raw: unknown): Layout. It checks each panel's
config with a validator for its type, turns an unknown type into a
placeholder panel that says so, runs the migrations from the document's
version up to the current one, and returns the default when the whole
document is not a layout. Write tests/layout.test.ts first and show me
it failing: an unknown type, a quote panel whose config names something
that is not a symbol, and a version 0 document without titles. Then add
src/app/dashboard/page.tsx, which draws parseLayout(DEFAULT_LAYOUT) as a
CSS grid of titled, empty panels (a placeholder panel says its type
is unknown), and a link to the page in the site's navigation. No panel fetches anything
yet, so no new request. Run npm test, typecheck, lint and check:leak,
and show me the diff first.
```

## 5. The panel contract (unit 2)

Mock mode on, plan mode on, and paste:

```
Plan this before writing. In src/lib/panels.ts write this panel contract:

type PanelProps<C> = {
  config: C;                       // already parsed for its type
  data: PanelData;                 // given, never fetched
  onSelect(symbol: string): void;  // the only way out
  onConfigChange(next: C): void;   // the only way to persist
};
type PanelData = {
  quotes: { row: QuoteRow; fetchedAt: number }[];   // its own symbols
  screen: { rows: ScreenRow[]; fetchedAt: number } | null;
  bars: { rows: DailyBar[]; fetchedAt: number } | null;
  selected: string | null;   // to mark a row; a click goes out by onSelect
};
type Needs = { quotes: string[]; screen?: ScreenConfig; eod?: string };
type PanelDef<C> = {
  parse(raw: unknown): C | null;
  dataNeeds(config: C): Needs;
  Component(props: PanelProps<C>): React.ReactNode;
};

QuoteRow, ScreenRow and DailyBar stand for the row types this repo
already has for a quote, a screen result and a daily bar; if the
watchlist shows notes, add them to PanelData too. Add unionNeeds, which
turns the quotes lists of many panels into one list of distinct
symbols. Implement the contract for three panels, one file each in
src/components/panels/ and nothing else in that folder:
WatchlistPanel.tsx for the watchlist, reusing the shared table and the
watchlist's columns; ScreenPanel.tsx, which shows the screen page's
results table for a saved screen; and BacktestPanel.tsx, which shows
the backtest page's summary for one symbol's end-of-day history. A
panel must not fetch, read storage or import another panel;
code the browser needs from a server-only file moves into a plain module
that holds no key. Each row of the table can be clicked and reports its
symbol through onSelect. Turn the dashboard into a client container,
src/components/Cockpit.tsx: it collects dataNeeds from every visible
panel, unions the symbols, asks the market store once, through the
proxy, and passes the data down; DEFAULT_LAYOUT in src/lib/layout.ts
now draws all three panels. Write tests/panels.test.ts first: two panels
needing one symbol give one entry, and the watchlist panel renders a
literal row to a string with no mock. Before wiring the fetch, tell me
with estimateCalls what one dashboard load costs. Mock mode. Run npm
test, typecheck, lint and check:leak, and show me the diff.
```

## 6. A click here changes something there (unit 2)

Mock mode on, plan mode on, and paste:

```
Plan, then build, selection for the dashboard. The container in
src/components/Cockpit.tsx owns one Selection { symbol, source } and a
select(symbol, source) that does nothing when that symbol is already
selected. Panels receive the selection and report clicks through
onSelect. Add a quote panel, src/components/panels/QuotePanel.tsx, to
the default layout, showing one symbol with its price and its age. Add follows to each panel's config, saved with the
layout: true for the quote panel, false for the watchlist. The container
decides what a following panel shows, and never drives a panel with a
selection that came from that panel. Mirror the symbol into the address
as ?symbol=, and accept it on the way in only if the page already shows
that symbol: read it back in an effect that runs again whenever what the
page shows changes, from window.location rather than the render's
searchParams. Tell me with estimateCalls what selecting a symbol costs;
one already on the watchlist must cost nothing. Write
tests/selection.test.ts first, for the no-op and the address check.
Mock mode. Run npm test, typecheck, lint and check:leak, and show me
the diff.
```

## 7. Named layouts, and the URL that shares them (unit 2)

Mock mode on, plan mode on, and paste:

```
Plan named layouts. Keep them as one document, "layouts", in the
document store (src/lib/store.ts), and add "layouts" to the keys its
route accepts: a record
of Layout by name, each read through parseLayout so every panel is
checked again. A field and a button, "New layout from this one", ask
for a name and make a new layout from the current one. Each panel's
title can be renamed in place. The switcher changes the layout in the
container's state and rewrites the address to ?layout=name&symbol=...
with the history API, with no page load; an unknown name falls back to
the default. Changes autosave with the version you read, a "Saved" note
appears beside the switcher once an autosave has landed, and "Revert to
saved" restores the copy that was stored when you opened the layout. An
Export button downloads the current layout as a JSON file. Write
tests/layouts.test.ts first, for the unknown-name fallback, creating a
layout from the current one, renaming a panel, and an autosave that
meets a newer version. Before writing the switcher, tell
me with estimateCalls what switching between two layouts that share
every symbol costs. Mock mode. Run npm test, typecheck, lint and
check:leak, and show me the diff.
```

## 8. Loading, empty, error — a cockpit's real states (unit 2)

Mock mode on, plan mode on, and paste:

```
Plan, then build, panel states. In src/lib/panel-state.ts derive one of
loading, refreshing, ready, empty or failed from what a panel holds: its
rows, whether a fetch is running, and its last failure. Refreshing keeps
the old rows on screen with a marker and never blanks them; a failure
keeps them too, labelled with their age. Give each failure kind in
src/lib/failure.ts its own sentence, what happened and what to do next:
404, a symbol that does not exist (name it); 402, out of calls for
today (they reset at 00:00 UTC, and retrying will not help); 429, too
many requests this minute (wait for Retry-After, then retry); 403, data
this plan does not cover; 5xx or a timeout, trouble upstream (retry).
Give the cockpit a Refresh button that asks the market store again, so
refreshing is something you can press. A panel with no symbols says it
has none; a panel whose request came back with nothing says that
instead. Wrap every panel in src/components/PanelBoundary.tsx, which
shows that the panel crashed, offers a reset, and leaves the others
drawing. Write
tests/panel-state.test.ts first: one test per state, each from a literal
fixture, and one per failure kind. Mock mode; Refresh only repeats the request the cockpit already makes. Run npm
test, typecheck, lint and check:leak, and show me the diff.
```

## 9. A heatmap panel, ported from an open-source app (unit 2)

Mock mode on, plan mode on, and paste:

```
Clone https://github.com/EodHistoricalData/eodhd-heatmap into
../eodhd-heatmap, next to this repo, and read vendor/heatmap.js.
Change nothing in either repo. Give me the recipe as a list of rules,
each with the file and line it comes from: how the treemap lays out
its tiles, how it groups and sizes sectors, what weight a company with
no market cap gets, how a change becomes a colour (every cut-off and
every colour), and what a tile shows when its change is unknown. No
code.
```

Then, once the rules read right:

```
Plan, then build, a heatmap panel from those rules. In a new
src/lib/heatmap.ts: squarify(items, rect), the squarified layout,
where a weight that is missing or not positive counts as 1;
treemap(rows, rect), sectors sized by summed market_capitalization,
largest first, and each sector's rows laid out inside its rectangle
below a strip for its name; changeOf(row), refund_1d_p, or null when
that is not a number, never 0; changeColor(change), the seven steps
on the change rounded to one decimal. The file opens with a comment
naming EodHistoricalData/eodhd-heatmap, vendor/heatmap.js and the MIT
licence. Write tests/heatmap.test.ts first: areas proportional to
weights, filling the rectangle with no overlap; every colour cut-off;
a row with no change giving null. Add a heatmap panel type whose
config is a screen config and whose dataNeeds asks for exactly the
screen a screen panel with the same filters and sort asks for. It
draws an SVG; each tile prints its ticker and signed change, or a
dash when the change is unknown, carries an aria-label that says the
same in words, and reports a click through onSelect. Add a second
built-in layout, Markets: a heatmap of the starter's screen sorted by
market cap, largest first, and a quote panel that follows the
selection; layoutsFrom offers it beside the saved layouts unless one
already has that name. Leave DEFAULT_LAYOUT alone. Mock mode. Run npm
test, typecheck, lint and check:leak, and show me the diff.
```

## 10. News sentiment, a new endpoint measured before it is drawn (unit 2)

Mock mode needs an answer to draw on, and ours is the live one of 13 November 2026 for Apple, Microsoft, NVIDIA and Vodafone. With the starter as your `upstream` remote, run `git fetch upstream` and then `git checkout upstream/ref/build-a-dashboard/u2 -- fixtures/sentiments.json`. Then mock mode on, plan mode on, and paste:

```
Plan, then build, a sentiment panel. First the endpoint, in one
commit: sentiments in ALLOWED_ENDPOINTS in src/lib/proxy.ts, and in
CALL_COST in src/lib/cost.ts at 5 calls per symbol, priced per symbol
like news. The answer is an object keyed by symbol, each a list of
days, newest first, with date, count and normalized; a symbol with
nothing is left out, and when none has anything the body is [], an
empty array. Teach src/lib/mock.ts to answer from
fixtures/sentiments.json in that shape, the empty array included. In
a new src/lib/sentiment.ts: tone(days), the mean of normalized
weighted by count, a count of 0 weighing 1 and a missing normalized
skipped; articles(days); trend(days), the newer half of the days
against the older, up or down past 0.05, flat otherwise; and one
reading per symbol that shows no tone below MIN_ARTICLES = 20. No
fear or greed bands. Write tests/sentiment.test.ts first. Add a
sentiment panel type: one to five symbols, follows false, dataNeeds
asking for sentiment for them. The container unions those symbols
across panels into one request and keeps the answer for an hour. The
panel's table sorts by tone, highest first, says how many articles
each reading rests on, and puts the too-few rows last. Add it to the
Markets layout on two symbols. Tell me with estimateCalls what one
load of Markets costs now. Mock mode. Run npm test, typecheck, lint
and check:leak, and show me the diff.
```

## 11. A portfolio panel whose sums you can check (unit 2)

Mock mode on, plan mode on, and paste:

```
Plan, then build, a portfolio panel. In a new src/lib/portfolio.ts:
a Trade has id, symbol, side (buy or sell), date, quantity, price and
fees. parseTrades(raw) refuses, never repairs: a symbol that is not
US-listed, a quantity or price that is not positive, negative fees, a
bad date, and a sell larger than what is held on its date.
openLots(trades) is first in, first out per symbol, buys before sells
on the same day, each lot carrying its fees per share.
positions(trades, quotes) gives quantity, cost, average cost, price
(the quote's close), value, unrealised gain, the day's change and
weight. Shares from lots dated on or after the quote's own day
move from what was paid, the rest from the previous close. A position
with no price is left out of the totals and counted, never valued at
zero; weights are over priced positions. The file opens with a comment
naming EodHistoricalData/eodhd-portfolio-tracker,
vendor/calculations.js and the MIT licence, with a line each for what
is not ported: realised gains, dividends, splits, other currencies.
Write tests/portfolio.test.ts first, with sums worked by hand: buy 10
at 100 with fees 5, buy 10 at 120, sell 15 leaves 5 at a cost of 600;
and a day with 10 shares held overnight and 5 bought that day. Add a
portfolio panel type whose config holds the trades and whose dataNeeds
names the symbols held: a table, a totals row, and a small form that
adds a trade through onConfigChange and says why when parseTrades
refuses it. Add it to the Markets layout with a few example trades.
Mock mode. Run npm test, typecheck, lint and check:leak, and show me
the diff.
```

## 12. Alert rules as data (unit 3)

Mock mode on, plan mode on, and paste:

```
Plan, then build. Turn the Rule in src/lib/rules.ts into this document:

type Rule = {
  id: string;
  symbol: string;
  field: "close" | "change_p" | "volume";
  op: ">" | "<" | "crosses_above" | "crosses_below";
  value: number;
  enabled: boolean;
  lastFiredAt: number | null;
  lastValue: number | null;
};

Add parseRules(raw: unknown), which drops any rule whose
field or operator is not on those lists rather than repairing it. Add a
pure evaluate(rule, quote) that returns { fires, nextLastValue }, reads
no clock and does no I/O. Write the tests first in tests/rules.test.ts
and show me them failing: crossing up, crossing down, exactly on the
threshold, and a quote without the field. Then ruleSentence(rule), which reads like "Alert when AAPL trades
above 320.00 (checked against the last price, not the session close)",
and list every rule on the dashboard with it. Keep the rules as a
"rules" document in the store (add "rules" to the keys its route
accepts), seeded from today's RULES. The home page's alerts must still
work. Mock mode, no new
request. Run npm test, typecheck, lint and check:leak; diff first.
```

## 13. Why your alert did not fire (unit 3)

Mock mode on, plan mode on, and paste:

```
Plan, then build, src/lib/check-all.ts with checkAll(rules, fetchQuotes,
now). It asks fetchQuotes once for the distinct symbols of the enabled
rules, runs evaluate from src/lib/rules.ts on each rule, and returns what
fired with each rule's next lastValue. It reads no clock and imports no
fetch. Write tests/check-all.test.ts first with a fake fetcher and a
fixed time, including two rules on one symbol. In the dashboard, run
checkAll through the market store each time the dashboard's quotes
arrive, on load and when I press Refresh: no timer and no extra
request. Put "Rules are checked while this page is open." beside the
rules. Then,
with estimateCalls and no request, price a server checking my enabled
rules every five minutes through a 6.5-hour session, and every minute,
and write both under an Alerts heading in PLAN.md next to my daily
allowance. Run npm test, typecheck, lint and check:leak, and show me
the diff first.
```

## 14. An alert that fires 300 times is mute (unit 3)

Mock mode on, plan mode on, and paste:

```
Plan, then build, flap control in src/lib/rules.ts. Each rule gets a
cooldown in minutes (default 60) and a re-arm level on the other side of
its threshold, and it fires only when its condition held on two checks
in a row. Key each firing as rule id plus observation timestamp, and
ignore a key already seen. Add digest(fired), which turns the firings of
one window into one message, a line each with symbol, value, rule and
UTC time. The dashboard's checks run with the guards on, and its rules
list shows each rule's current value and its distance from the
threshold. Write tests/flapping.test.ts first: a literal series of prices
crossing a threshold back and forth, one check a minute for less than an
hour so the whole series sits inside one cooldown, replayed through
checkAll with a fake clock, counting firings with the guards off and on,
each test named with its count. No real data: the series is written in the test. Run npm test, typecheck, lint and
check:leak, and show me the diff.
```

## 15. Review the whole surface (unit 3)

Write your own findings into `REVIEW.md` first. Then start a fresh session, so the reviewer did not build what it reads, and paste:

```
Review the dashboard as a whole against REVIEW.md: src/lib/store.ts and
its route, src/lib/market-store.ts, src/lib/panels.ts, the Cockpit and
src/lib/rules.ts. For each of the four lenses list findings with file
and line, then tell me which lens my checklist is weakest on. Check in
particular that a request for another user's layouts document answers
404 and not 403, that a panel taken out of the layout adds nothing to the union of needs, that
switching layouts refetches nothing already cached, and that the cockpit
still draws when the store cannot be reached. Fix nothing. Save the
review to notes/review-cockpit.md, and make no request.
```

## 16. What "real-time" actually means (unit 4)

Mock mode on, plan mode on, and paste:

```
Plan, then build. In src/lib/age.ts add ageSeconds(timestamp, now) on
Unix seconds, ignoring gmtoffset, and medianGap(timestamps): the median
of the gaps between distinct consecutive values. Test both first in
tests/age.test.ts with literal timestamps. Show each quote panel's age
from its own rows, and the oldest of them in the header. The screen and
the backtest rows carry a date, not a timestamp: those panels say end
of day and name the date, and so does the header. Then write
scripts/sample-interval.mjs: run as node scripts/sample-interval.mjs
SYMBOL N --yes, it asks the running dev server's proxy for that
symbol's real-time quote N times, a minute apart, and prints each
timestamp and the median gap; without --yes it prints the price and
stops. It runs on plain Node with no warnings. Before any live run,
tell me with estimateCalls what N samples of one symbol cost against
my allowance, and wait for my yes. Mock mode for the tests. Mock mode for everything else. Run npm test,
typecheck, lint and check:leak, and show me the diff first.
```

## 17. The refresh budget (unit 4)

Mock mode on, plan mode on, and paste:

```
Plan, then build, src/lib/budget.ts. refreshCost(requests) prices one
refresh with estimateCalls from the same requests the market store will
send, and returns null if any of them is not in the cost table, so the
figure cannot drift from the fetch. Each panel's config gets a refresh
of live, minutes, daily or manual; a backtest is manual and cannot be
set otherwise. The container's loop skips while document.visibilityState
is hidden, leaves out each symbol whose exchange is outside its regular
session (crypto never closes, an unknown exchange counts as open), and
refreshes once on focus. Show calls used today from the usage route,
the daily limit, and the time the limit will be reached at the current
rate, with each interval priced as its own round. Write
tests/budget.test.ts first, for this worked cockpit and for the
projection: a watchlist of 12 live quotes costs 12, one screen request
5, a quote panel on a symbol already among the 12 costs 0, one
end-of-day series 1, so 18 per refresh, and refreshing every five
minutes for 6.5 hours is 78 x 18 = 1,404 calls a day. Mock mode; tell me the per-refresh price of my
current layout before wiring the loop. Run npm test, typecheck, lint and
check:leak, and show me the diff.
```

## 18. The real-time wall (unit 4)

Mock mode on, plan mode on, and paste:

```
Plan, then build, the wall. Add shouldRefresh to src/lib/budget.ts: no
automatic refresh once the calls left would not cover one more refresh
plus a reserve the size of one refresh by hand, while a refresh by hand
may spend the reserve. The wall holds back the loop, Refresh and Retry,
not the page's first load: the meter lags behind the API and a 402
costs nothing, so the API's answer decides that one. When it
says no, or a request answers 402, show "Refresh paused: <used> of
<limit> calls used today, resets at 00:00 UTC", and keep every panel's
rows on screen in its stale state with its real age. A 429 waits for
Retry-After and tries again; a 402 never retries. Write the tests first
in tests/budget.test.ts, including a fake fetcher that answers 402. Add a
Refresh button and, on a failed panel, a Retry button if the cockpit
does not have them yet; both go through the same wall. Then fill in
these five lines in PLAN.md with my layout's price per refresh and my
plan's limit from the usage route:

Calls per refresh:        ___
Daily allowance:          ___
Refreshes it buys:        ___
Alert loop needs:         ___ calls/day
Therefore alerts:         ___

The last line says what my alerts can and cannot do on my plan. No
live request.
Run npm test, typecheck, lint and check:leak, and show me the diff
first.
```
