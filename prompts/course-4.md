# Course 4 prompts: Build a Dashboard

The prompts the lessons of this course ask you to paste, in lesson order, copied from the
lessons themselves. Start Claude Code in this folder with `EODHD_MOCK=1` in `.env.local`,
paste one prompt at a time, and read the plan before you say yes. Each lesson says what a
good answer changes and how to check it yourself.

The reference state at the end of each unit is on the branch `ref/build-a-dashboard/u<unit>` of this
repository: `git fetch upstream`, then `git diff upstream/ref/build-a-dashboard/u1`.

## 1. Three tools, one product — what composition costs (unit 1)

Mock mode on (`EODHD_MOCK=1` in `.env.local`), plan mode on, and paste:

```
Read the three tools in this repo: the watchlist (src/app/page.tsx and
what it imports), the screen page and the backtest page. List every piece
of state they keep: each localStorage key, each cookie, each constant a
person edits by hand, each value a component holds. For each one, say
where it lives today and which tier it belongs to once the three share a
dashboard: panel-local, shared or persisted, with a one-line reason.
Then draft a Rebuild section for the cockpit under survives, generalises,
new and dies. Write both into PLAN.md and nothing else. Change no code,
make no request, and show me the diff before saving.
```

## 2. Move persistence off the browser (unit 1)

In the starter the watchlist itself is a file and a cookie; what lives in `localStorage` is the saved screens, the shortlist and the notes, all through `src/lib/stored.ts`. This prompt moves the saved screens. The other two follow the same way, a commit each, and the sort order stays where it is, because it is panel-local.

Mock mode on, plan mode on, and paste:

```
Plan step 1 of moving the saved screens off the browser, and only step 1.
Add src/lib/store.ts: documents keyed by user and key, each with a
version integer, a payload and updatedAt, one table docs in SQLite
through Node's built-in node:sqlite, in .data/app.db, which git
ignores; the tests use ":memory:". putDoc takes the version the caller
read and refuses the write if it has moved, in one conditional UPDATE,
so two writes arriving together cannot both pass. Every function takes
the user first, and
src/lib/user.ts is the one place the current user comes from. Add the
route src/app/api/store/[key]/route.ts: GET is 404 for a missing
document, PUT is 409 on a stale version, and only the keys I list exist.
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
Plan, then build, src/lib/layout.ts from the Panel and Layout types in
this lesson. Add DEFAULT_LAYOUT: a watchlist, one screen and the
backtest. Add parseLayout(raw: unknown): Layout. It checks each panel's
config with a validator for its type, turns an unknown type into a
placeholder panel that says so, runs the migrations from the document's
version up to the current one, and returns the default when the whole
document is not a layout. Write tests/layout.test.ts first and show me
it failing: an unknown type, a quote panel whose config names something
that is not a symbol, and a version 0 document without titles. Then add
src/app/dashboard/page.tsx, which draws DEFAULT_LAYOUT as a CSS grid of
titled, empty panels, and a link to it in Nav. No panel fetches anything
yet, so no new request. Run npm test, typecheck, lint and check:leak,
and show me the diff first.
```

## 5. The panel contract (unit 2)

Mock mode on, plan mode on, and paste:

```
Plan this before writing. In src/lib/panels.ts write the panel contract
from this lesson: PanelProps<C> with config, data, onSelect and
onConfigChange, and a panel definition with parse(config),
dataNeeds(config) and the component. Implement it for the watchlist in
src/components/panels/WatchlistPanel.tsx, reusing DataTable and the
watchlist's columns; it must not fetch, read storage or import another
panel. Turn the dashboard into a client container,
src/components/Cockpit.tsx: it collects dataNeeds from every visible
panel, unions the symbols, asks the market store once, through the
proxy, and passes the rows down. Write tests/panels.test.ts first: two
panels needing one symbol give one entry, and the watchlist panel
renders a literal row to a string with no mock. Before wiring the fetch,
tell me with estimateCalls what one dashboard load costs. Mock mode. Run
npm test, typecheck, lint and check:leak, and show me the diff.
```

## 6. A click here changes something there (unit 2)

Mock mode on, plan mode on, and paste:

```
Plan, then build, selection for the dashboard. The container in
src/components/Cockpit.tsx owns one Selection { symbol, source } and a
select(symbol, source) that does nothing when that symbol is already
selected. Panels receive the selection and report clicks through
onSelect. Add follows to each panel's config, saved with the layout:
true for a new quote panel, false for the watchlist. The container
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
Plan named layouts. Keep them as one document, "layouts", in the store
from unit 1: a record of Layout by name, each read through parseLayout
so every panel is checked again. The switcher changes the layout in the
container's state and rewrites the address to ?layout=name&symbol=...
with the history API, with no page load; an unknown name falls back to
the default. Changes autosave with the version you read, and "Revert to
saved" restores the copy that was stored when you opened the layout. An
Export button downloads the current layout as a JSON file. Write
tests/layouts.test.ts first, for the unknown-name fallback and an
autosave that meets a newer version. Before writing the switcher, tell
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
src/lib/failure.ts its own sentence: what happened and what to do next.
Wrap every panel in src/components/PanelBoundary.tsx, which shows that
the panel crashed, offers a reset, and leaves the others drawing. Write
tests/panel-state.test.ts first: one test per state, each from a literal
fixture, and one per failure kind. Mock mode, no new request. Run npm
test, typecheck, lint and check:leak, and show me the diff.
```

## 9. Alert rules as data (unit 3)

Mock mode on, plan mode on, and paste:

```
Plan, then build. Turn the Rule in src/lib/rules.ts into the document
from this lesson: add id, enabled, lastFiredAt and lastValue; fields
close, change_p and volume; operators >, <, crosses_above and
crosses_below. Add parseRules(raw: unknown), which drops any rule whose
field or operator is not on those lists rather than repairing it. Add a
pure evaluate(rule, quote) that returns { fires, nextLastValue }, reads
no clock and does no I/O. Write the tests first in tests/rules.test.ts
and show me them failing: crossing up, crossing down, exactly on the
threshold, and a quote without the field. Then ruleSentence(rule), and
keep the rules as a "rules" document in the store, seeded from today's
RULES. The home page's alerts must still work. Mock mode, no new
request. Run npm test, typecheck, lint and check:leak; diff first.
```

## 10. Why your alert did not fire (unit 3)

Mock mode on, plan mode on, and paste:

```
Plan, then build, src/lib/check-all.ts with checkAll(rules, fetchQuotes,
now). It asks fetchQuotes once for the distinct symbols of the enabled
rules, runs evaluate from src/lib/rules.ts on each rule, and returns what
fired with each rule's next lastValue. It reads no clock and imports no
fetch. Write tests/check-all.test.ts first with a fake fetcher and a
fixed time, including two rules on one symbol. In the dashboard, run
checkAll through the market store while the page is open, and put
"Rules are checked while this page is open." beside the rules. Then,
with estimateCalls and no request, price a server checking my enabled
rules every five minutes through a 6.5-hour session, and every minute,
and write both under an Alerts heading in PLAN.md next to my daily
allowance. Run npm test, typecheck, lint and check:leak, and show me
the diff first.
```

## 11. An alert that fires 300 times is mute (unit 3)

Mock mode on, plan mode on, and paste:

```
Plan, then build, flap control in src/lib/rules.ts. Each rule gets a
cooldown in minutes (default 60) and a re-arm level on the other side of
its threshold, and it fires only when its condition held on two checks
in a row. Key each firing as rule id plus observation timestamp, and
ignore a key already seen. Add digest(fired), which turns the firings of
one window into one message, a line each with symbol, value, rule and
UTC time. Write tests/flapping.test.ts first: a literal series of prices
crossing a threshold back and forth, replayed through checkAll with a
fake clock, counting firings with the guards off and on. No real data:
the series is written in the test. Run npm test, typecheck, lint and
check:leak, and show me the diff.
```

## 12. Review the whole surface (unit 3)

Write your own findings into `REVIEW.md` first. Then start a fresh session, so the reviewer did not build what it reads, and paste:

```
Review the dashboard as a whole against REVIEW.md: src/lib/store.ts and
its route, src/lib/market-store.ts, src/lib/panels.ts, the Cockpit and
src/lib/rules.ts. For each of the four lenses list findings with file
and line, then tell me which lens my checklist is weakest on. Check in
particular that a request for another user's document answers 404 and
not 403, that a collapsed panel adds nothing to the union of needs, that
switching layouts refetches nothing already cached, and that the cockpit
still draws when the store cannot be reached. Fix nothing. Save the
review to notes/review-cockpit.md, and make no request.
```

## 13. What "real-time" actually means (unit 4)

Mock mode on, plan mode on, and paste:

```
Plan, then build. In src/lib/age.ts add ageSeconds(timestamp, now) on
Unix seconds, ignoring gmtoffset, and medianGap(timestamps): the median
of the gaps between distinct consecutive values. Test both first in
tests/age.test.ts with literal timestamps. Show each quote panel's age
from its own rows, and the oldest of them in the header. The screen and
the backtest rows carry a date, not a timestamp: those panels say end
of day and name the date, and so does the header. Then write
scripts/sample-interval.mjs: it asks the running dev server's proxy for
one symbol's real-time quote N times, a minute apart, and prints each
timestamp and the median gap. Before any live run, tell me with
estimateCalls what N samples of two symbols cost against my allowance,
and wait for my yes. Mock mode for everything else. Run npm test,
typecheck, lint and check:leak, and show me the diff first.
```

## 14. The refresh budget (unit 4)

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
tests/budget.test.ts first, for the worked cockpit in this lesson and
for the projection. Mock mode; tell me the per-refresh price of my
current layout before wiring the loop. Run npm test, typecheck, lint and
check:leak, and show me the diff.
```

## 15. The real-time wall (unit 4)

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
in tests/budget.test.ts, including a fake fetcher that answers 402. Then
fill in the five PLAN.md lines from this lesson with my layout's price
per refresh and my plan's limit from the usage route. No live request.
Run npm test, typecheck, lint and check:leak, and show me the diff
first.
```
