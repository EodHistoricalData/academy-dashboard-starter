# Reference branches

This branch is one of the `ref/<course>/u<unit>` branches: what a careful learner has at
the end of a unit, built on the branch before it. Compare yours with
`git diff upstream/ref/<course>/u<unit>` (see `prompts/README.md` for the remote).

Everything runs in mock mode (`EODHD_MOCK=1`); no branch needs a key. Where a lesson left
a choice to you, the section for that unit says which one we made. Yours can differ.

## Build Your First Tool · unit 1: Safe Wiring and the First Win

- `PLAN.md`: the five sections from the first lesson, for a 7am watchlist.
- `AGENTS.md`: one line under the rules that points every agent at `PLAN.md`. We did not
  add `@PLAN.md` to `CLAUDE.md`: the sentence in `AGENTS.md` works for every agent, and one
  pointer is easier to keep true than two.
- `src/lib/watchlist.ts`: three instruments, as the first-data lesson asks. The meter
  beside them already ships with the starter.
- Nothing from the leak-check exercise is left behind: that lesson ends with the code put
  back. `.env.local` is yours and is never committed.

## Build Your First Tool · unit 2: First Light on Your Symbols

- The loop: the page heading now says when the page is for ("Before the open"); the loading
  skeleton carries the same words so nothing changes under the eye.
- Your tickers: `VOD.LSE` joins the list as the non-US listing, with a fixture row in
  `fixtures/real-time.json`. It quotes in pence; nothing on the page totals a column, so
  the mixed list is left as it is rather than labelled per row.
- When the data does not arrive: `quotes()` reads the status before the body and returns
  either rows or a named failure (`src/lib/failure.ts`). The page says which one: rejected
  key (401), plan does not cover it (403), day spent (402, with the meter beside it), busy
  minute (429), unreachable. `tests/failure.test.ts` pins each status.
- Done means green: `tests/rows.test.ts` is the lesson's test, unchanged. `toRows` in
  `src/lib/rows.ts` keeps an unknown symbol as an "unavailable" row. A row with prices but
  no numeric volume is kept, with volume shown as "—", because the lesson's own test row has
  no volume.
- The missing key, as the lesson's last step asks: criterion and test in
  `tests/failure.test.ts` ("is reported before any request is sent"). `hasKey()` lives in
  `src/lib/eodhd.ts`, the one file that reads the key.
- `tests/proxy.test.ts` changed in one place: `quotes()` now returns `{ rows }` or
  `{ failure }`, so the mock-mode test reads `result.rows`.

## Build Your First Tool · unit 3: Make It Yours

- `PLAN.md` is edited, as the first lesson said it would be: sorting, notes and one rule move
  into scope; search and syncing notes stay out.
- Sorting: `sortRows` in `src/lib/sort.ts`, three keys (as written, change %, volume), ties
  broken by ticker, rows without prices last. `tests/sort.test.ts` has the lesson's tie test
  (two tied rows in both orders). The control is a client island,
  `src/components/SortedWatchlist.tsx`; the choice is kept in localStorage under
  `watchlist-sort-v1`. The page stays a server component and passes finished rows down.
- Notes: `loadNotes` in `src/lib/notes.ts` under `watchlist-notes-v1`, keyed by ticker, and
  `tests/notes.test.ts` feeds it half a write. The editor is `src/components/NoteField.tsx`,
  one input per row. Below 640px the note column is hidden, like volume: on a phone the
  table has room for prices only. We kept `tags` in the type but built no tag editor: the lesson asks for
  a note field, and tags earn a place only once you reuse them.
- `src/lib/stored.ts` is the one place that touches localStorage, through
  `useSyncExternalStore`, so the server render sees nothing saved and nothing flickers into
  a wrong state.
- Rules: `Rule`, `fires` and `alertText` in `src/lib/rules.ts`, tested first in
  `tests/rules.test.ts` against a literal quote. Our choice: the rules are a data array in
  that file, checked on the server when the page renders, not in localStorage like the
  notes, because one rule needs no editor. The rule (MSFT.US down more than 0.5%) fires on
  the fixtures. The sentence about when rules are checked sits under the rules panel.
- Your symbols: the full list in reading order, with `005930.KO` as the listing we suspect
  the plan does not cover. In mock mode it is unavailable because `fixtures/real-time.json`
  has no row for it; live, which of yours come back empty depends on your plan.

## Build Your First Tool · unit 4: Make It Real, and Ship It

- How old is this number: nothing to add. The data-age line with its band is the
  `Freshness` panel the starter ships, computed from the quotes' own timestamps.
- The wall: four lines in `PLAN.md`. Cost per view and views per day come from the cost
  table (the page's "Live, it would cost 7 calls"), not from a live meter: this branch runs
  on fixtures. Measure yours on your own account; the data age especially.
- Fork and deploy: `scripts/check-network.mjs` is the network-tab check as a script. Our
  choice: it fetches the page and every same-site script and fails on an EODHD API address
  or `api_token` in them, rather than driving a headless browser, so the project gains no
  dependency. Its header says what that cannot see. `tests/check-network.test.ts` tests the
  matcher. Run it as `node scripts/check-network.mjs https://your-app.example`.
- What the exam checks: `PLAN.md` marks each line of the definition of done and names the
  next thing. This copy is not deployed, and says so.

## Build a Screener · unit 1: Plan the Rebuild

- `PLAN.md` gains the rebuild section: every file under survives, generalises, new or dies,
  and the universe decision (common stock; preferred, funds, ETFs, indices out).
- Our choice for the universe: `/screener` has no instrument-type filter we rely on, so the
  screen's own `earnings_share > 0` keeps funds and indices out. It also drops loss-makers,
  and the page says so.
- First screen: `src/lib/screens.ts` (request, `toScreenRows` reading under `data`,
  `screenErrors` naming the refused filter by its path) and the page at `/screen`. Our two
  filters: market cap over $10B and earnings per share above zero, on US exchanges, largest
  first, 20 rows. Yield is shown as a percentage of the fraction the API sends. The session
  date is on the page. `tests/screens.test.ts` covers the wrapper, the error envelope and the
  cost (5 calls).
- The route is `/screen`, the name the last unit of the course uses; one lesson writes
  `/screener?f=...` for the same page.
- The notices both pages need (mock mode, no key, a named failure) moved to
  `src/components/Notices.tsx`. `WallMeter` takes a `basis`, so the screen does not claim
  "one per ticker".
- In mock mode the screener answers from `fixtures/screener.json` whatever the filters; the
  misspelled-field exercise only shows its message live, or in the test.
- Market caps are printed in full here. Unit 3's review finds that unreadable and fixes it.

## Build a Screener · unit 2: Rebuild It

- The data layer: `src/lib/market.ts` holds the transport (key check, `eodhdFetch`, status
  before body, narrowing). `quotes()` kept its signature; the watchlist rendered
  pixel-identical before and after. `tests/market.test.ts` pins what that screenshot showed
  and no test covered: the unavailable 005930.KO row and the MSFT rule's sentence.
- One table: `src/components/DataTable.tsx` with the lesson's `Column<T>`. Two additions,
  both needed by the watchlist from course 1: `tone` (green and red, beside the sign) and
  `input` (the note field, which is a control, not a string). On a phone the table now
  scrolls sideways instead of hiding columns. The screener's columns are
  `src/lib/screen-columns.ts`; the EPS column was added as the lesson's test, one entry in
  that one file.
- Filters as data: `src/lib/filters.ts` (fields, operators, sectors and sorts as fixed
  lists, `safe`, `clampLimit`, the address form `f=field:op:value`). The proxy rebuilds any
  `/screener` query from checked values and clamps `limit` (`tests/proxy.test.ts` has the
  three attacks); the page checks the address the same way and names what it dropped. The
  universe filter (`exchange = us`) is added by the code, never read from input.
- Our choice: the lesson says both "clamp" and "refused" for `limit=100000`; the proxy clamps
  it to 100 and the test checks what goes upstream.
- Saved screens: `src/lib/saved-screens.ts` under `screens-v1`, keyed by name, criteria
  only, and `src/components/SavedScreens.tsx`. A saved screen reopens as its address.
- In mock mode the fixture does not screen: any filters or sort show the same twenty rows.
  What the filters do is in the tests.

## Build a Screener · unit 3: Code Review as a Process

- `REVIEW.md`: the four lenses in our words, a screener example under each, how to write a
  finding, the findings this unit made and the test each became, and the prompt for a
  reviewer who did not write the change.
- Leaks: the proxy now returns only the table's fields for a successful `/screener` answer
  (error bodies still pass through, because they say what went wrong), and says
  "EODHD_API_KEY is not set" with a 503 before sending anything. `api_token=fake` and
  `limit=99999` were already covered by unit 2's tests.
- Cost: `screenPageCalls` and a test that pins the screen page at 5 calls.
- Lies: `src/lib/format.ts` (`asPercent`, `signedPercent`, `compact`, `cell`) and
  `tests/format.test.ts` with the lesson's literals. Market cap reads 4.55T; the close
  carries its currency symbol on every row, and no sort is offered on price.
- A reviewer who did not write it is a process (branch, pull request, fresh session, CI as
  the gate); nothing in the code changes for it. A reference branch has no pull request of
  its own, so the review prompt lives in `REVIEW.md`.

## Build a Screener · unit 4: Make It Real, and Ship It

- A shortlist you can defend: `src/lib/shortlist.ts` (`shortlist-v1`, keyed by code) and
  `src/components/Shortlist.tsx`. A row's "Shortlist" opens a field for the reason and will
  not save without one. No composite score: the sort stays a single named field.
- The breadth wall: five lines in `PLAN.md`. The instrument counts are the course's count of
  the US symbol list; this copy runs on fixtures and did not count.
- Ship it beside the watchlist: `src/components/Nav.tsx` (two links, on both pages and the
  loading skeleton) and "Add to watchlist" on every screen row.
- Our choice for the join: course 1 kept the watchlist in `src/lib/watchlist.ts`, a file a
  button cannot edit. Names added from the screen go into a cookie (`watchlist-added-v1`)
  through a server action (`src/app/watchlist-actions.ts`); the server reads it beside the
  file (`src/lib/my-tickers.ts`), so quotes are still fetched on the server. Every value is
  checked against the ticker shape, the list is capped at ten, and each added name can be
  removed from the watchlist page.
- The screener's codes have no exchange suffix; `toTicker` adds it from the row's
  `exchange`, which `ScreenRow` now carries.
- `scripts/check-network.mjs` takes several pages: run it on `/` and `/screen`.
- `fixtures/real-time.json` gains GOOGL.US and AMZN.US, so a name added from the screen shows
  prices in mock mode.
- `PLAN.md` ends with what was awkward about the join, as the brief for course 4.

## Backtest Strategies · unit 1: The Research Sandbox

- `PLAN.md`: the one honest sentence, every blank filled, written before any code.
- Data: `fixtures/eod/SPY.US.json`, one year of daily bars, the depth of the free plan.
  Invented prices in the API's shape, with four dividends in `adjusted_close`; the last bar
  matches the real-time fixture. We chose SPY because a single index fund has no
  survivorship problem worth the name (unit 3 says why that matters).
- Candles: `src/lib/backtest/candles.ts` loads through the same transport as the watchlist
  and the screen, narrows a bare array of bars, asserts oldest-first, and caches the whole
  history on disk under `.cache/eod/` with the date it was pulled (gitignored; skipped in
  mock mode). `src/lib/market.ts` now keeps a plain-text error body as text, so an unknown
  ticker shows "Ticker Not Found." instead of a JSON parse error.
- Returns: `src/lib/backtest/returns.ts` on `adjusted_close`, compounded by multiplying;
  `parseSplit` for the splits endpoint's string ratio. `tests/returns.test.ts` uses the
  lesson's five AAPL bars across the 2020 split.
- The control: `/backtest` draws buy and hold with the net-of-cost line on at 0 bps, and
  three numbers under it (`src/lib/backtest/baseline.ts`, `metrics.ts`). The chart is a
  server-drawn SVG (`src/components/EquityChart.tsx`), so no chart library is added.

## Backtest Strategies · unit 2: Rules and Positions

- Files follow the rewritten lessons: `signal.ts` (the rule's signal), `positions.ts`
  (positions(signal), one bar later), `strategy.ts` (positions into trades and curves),
  `params.ts` (Params and DEFAULTS, re-exported by `strategy.ts`), `timeInMarket` in
  `metrics.ts`; tests `leak.test.ts`, `positions.test.ts`, `benchmark.test.ts`. Our `sma`
  takes `(values, n, i)` and `signals` takes `(bars, { fast, slow })`; the lesson's
  versions take `(bars, i, n)` and `(bars, fast, slow)`: the same arithmetic.

- The rule: `src/lib/backtest/signal.ts`, a 20/50 moving-average crossover on adjusted
  close, computed forwards in one pass. `sma` throws on a short window rather than averaging
  what `slice` returned. `tests/leak.test.ts` is the lesson's leak test (120 synthetic
  bars, change bars 81 to 120, the signal at bar 80 must not move); it was run red on a
  centred window first.
- Parameters: `Params` and `DEFAULTS` (20, 50, 10 bps) in `src/lib/backtest/strategy.ts`; the
  page reads `?fast=&slow=&costBps=` through `src/lib/backtest/params.ts`. Every run on the
  page is appended to `.cache/runs.jsonl` (`src/lib/backtest/runlog.ts`), and the page shows
  how many parameter sets were tried. The defaults' first result is written in `PLAN.md`.
- Entries and exits: `backtest()` is a four-branch state machine; the signal on bar i sets
  the position on bar i+1, an open position is closed on the last bar, costs are charged at
  each change. Our choice for this unit: the fill is the signal bar's close, which is what
  a one-bar shift of close-to-close returns means. Unit 3 changes it to the next open.
- Trades are recorded with raw prices and returns on the adjusted column; the page lists
  the first ten.
- The comparison: the control starts on the strategy's first bar with the same costs; four
  numbers per line (total return, time in market, trades, max drawdown) and the neighbours
  table (fast ±2, slow ±5). Neighbour runs are not logged as attempts.

## Backtest Strategies · unit 3: Honesty Checks

- Files follow the rewritten lessons: the shuffled control is in `shuffle.ts` (with the
  fill-range check the tests use), and the tests are split as the lessons split them:
  `costs.test.ts` (what was paid), `fills.test.ts` (inside the bar's range, next open,
  slippage), `honesty.test.ts` (the two leak tests and the shuffle). Costs and slippage stay
  inside `strategy.ts`, charged at each position change.

- Costs: charged at each position change, compounding; the page prints cost as a share of
  the starting balance and of the gross gain, and the net return at 0, 5, 10 and 25 bps.
- Slippage and fills: `Params` gains `slippageBps` (default 5, always against the trade)
  and `fill`, defaulting to `"next-open"`; `"signal-close"` stays available to show what it
  flatters. Opens are adjusted by the same factor as that bar's close so returns stay on the
  adjusted column. Every fill is recorded with its bar; the page shows the median overnight
  gap on the fill bars beside the cost assumption.
- The four tests, in `tests/honesty.test.ts` on the SPY fixture: future mutation,
  truncation, fill range, and the shuffle, labelled as a null test for time structure.
  `src/lib/backtest/shuffle.ts` holds `fillsOutsideRange` and a seeded `shuffled`.
- Our choice for the fill-range assertion: it checks the price filled at (the bar's open,
  or its close) before slippage; with slippage added, a fill at an open that was also the
  day's high would sit outside the range by construction.
- The unit-2 engine tests keep their hand-worked numbers by running the unit-2 model
  (`fill: "signal-close"`, no slippage) explicitly.
- Survivorship: the backtest runs on SPY alone and says so on the page and in `PLAN.md`,
  with the course's live and delisted counts. Counting the delisted list yourself is one
  request through the proxy; nothing in the tool needs it.
- Built twice: `src/lib/backtest/twin.ts` computes the same curves without the state
  machine, by cutting each day into a night and a day and asking whether a unit was held
  through each. It shares the signal with `strategy.ts` and nothing else.
  `tests/twin.test.ts` holds the two to a billionth on every bar, on four runs (defaults,
  costs off, fills at the signal's close, a fast pair), checks that those runs trade and
  that one still holds at the end, and puts a four-for-one split into the fixture while the
  default run is holding: both curves stay where they were, and only the printed fill
  prices before the split change.
- The adjusted column audited: `src/lib/backtest/adjustment.ts` checks that the factor
  `adjusted_close / close` steps on the record's ex-dividend and split days, by the amount
  the record says, and on no other day. Dividends are read from `unadjustedValue`, the cash
  paid, not `value`. `src/lib/backtest/actions.ts` fetches `/div` and `/splits` once per
  pull of the history and caches them beside it, tied to its `pulledAt`; the page prints
  the check under the results and moves a mismatch to the top. Mock mode reads
  `fixtures/div/SPY.US.json` (the four dividends already in the bars) and
  `fixtures/splits/SPY.US.json` (none). `tests/adjustment.test.ts` uses Apple's 2020
  dividend and split as /eod, /div and /splits gave them on 2026-11-13, and joins the
  returns lesson's older pull to the newer one to show the step nobody paid.

## Backtest Strategies · unit 4: Robustness, and the Wall

- Files follow the rewritten lessons: the walk-forward is `split.ts`, with the split
  written down as `SPLIT_DATE = "2026-07-16"`, 70% through the fixture's year and the same
  bar (175) the share gave; time under water is in `metrics.ts` with
  `tests/metrics.test.ts`. `from` (YYYY-MM-DD) in the address trims the cached history for
  the history wall, without a request. `PLAN.md` now says the fixture's year is invented
  and holds no regime, instead of describing it as if it were a real year. Our
  `timeUnderWater(curve)` returns bar indexes, where the lesson's takes the dates as well
  and returns them: the same run, read the same way.

- Drawdown properly: `timeUnderWater` and `returnOverDrawdown` in
  `src/lib/backtest/metrics.ts`, tested on a hand-worked series. The page prints max
  drawdown, time under water and return over drawdown for both lines, and shades the
  strategy's longest stretch under water on the chart.
- In-sample, out-of-sample: `src/lib/backtest/split.ts` splits 70/30 by date, tunes a
  15-pair grid on the first part only, and runs the winner once from the split (signals may
  read earlier bars). A test changes the out-of-sample bars and asserts the choice does not
  move. The prediction went into `PLAN.md` in its own commit before the run; the result
  follows it. Walking forward over several folds is not built: one year holds one split.
- The history wall: three lines in `PLAN.md`. The "everything against 2015-onward"
  comparison does not apply to a one-year history and the plan says so.
- The report: `/backtest/report` returns a Markdown file generated from the run
  (`src/lib/backtest/report.ts`), with claim, parameters, data, assumptions, results against
  the control, robustness (in- and out-of-sample, neighbours, parameter sets tried from the
  run log), the leak checks run on that data (`honestyChecks`), and what was not tested. In
  mock mode it says the prices are the fixture's. `tests/report.test.ts` checks its sections.
- The checkpoint lesson asks for nothing new in the code.

## Build a Dashboard · unit 1: Compose, and Decide Where State Lives

- `PLAN.md`: the State section (every localStorage key, cookie and hand-edited constant,
  placed panel-local, shared or persisted) and the Rebuild section for the cockpit.
- The document store, our choice: `src/lib/store.ts` keeps one row per user per document
  in SQLite through Node's built-in `node:sqlite` (`.data/app.db`, gitignored; tests use
  `:memory:` through `STORE_FILE` in `vitest.config.mts`). A write carries the version it
  read and is applied by one conditional `UPDATE`, so two writes arriving together cannot
  both win; a stale one gets 409 "Your other tab is ahead". The lesson's JSON-file store
  reads the whole file, awaits, and writes it back, which loses a write when two arrive at
  once; this is the same API with that gap closed. `node:sqlite` needs Node 22.13 or later
  without a flag, so `engines` and `@types/node` moved to 22; `.nvmrc` already said 22.
- Sign-in, our choice: the starter had no users. One owner signs in at `/login` with
  `DASHBOARD_PASSWORD`, compared in constant time; `SESSION_SECRET` signs an httpOnly
  cookie with `node:crypto` (`src/lib/session.ts`). `src/lib/user.ts` is the one place the
  current user comes from. In mock mode with no password, user 1 is assumed and the pages
  say so. User ids are integers. The two variables are documented in the README; this
  branch could not edit `.env.example` (see the report).
- `src/app/api/store/[key]/route.ts`: GET 404 for a missing document, for a key not on the
  list, and for another user's document; PUT 409 on a stale version. `tests/store.test.ts`
  covers the store and the route as two users.
- Step 1 of the migration, a commit each: saved screens, the shortlist, then the notes read
  from the server and fall back to this browser's copy when the server has none; writes go
  to both (`src/lib/use-doc.ts`). Writes go out one at a time with the version each got
  back, so typing a note key by key never meets a 409. The sort order stays in this browser.
- `src/lib/market-store.ts`: the lesson's store, tested with a fake fetcher. The home page's
  time is now the oldest quote, and the age beside it follows it (one more expression than
  the lesson names, or the panel would print an old time over a newer age).
- `src/lib/layout.ts`: panel configs are a typed union, checked per type on read; an unknown
  type or a failed check becomes a placeholder panel. `/dashboard` draws the default layout
  (watchlist, one screen, the backtest) as a grid and fetches nothing.
- Structure only: `src/lib/screen-query.ts` and `src/lib/backtest/bars.ts` hold the parts of
  the screener and the backtest with no disk or network in them, so the browser can use
  them in unit 2.

## Build a Dashboard · unit 2: The Cockpit

- The contract: `src/lib/panels.ts` (`PanelProps`, `PanelDef`, `unionNeeds`). Our addition:
  `Needs` may also ask for one screen or one daily history, because the screen and the
  backtest are panels too (`src/components/panels/`); quotes stay a symbol list so they
  union. The watchlist panel reuses `DataTable` and the watchlist's price columns; notes
  arrive as data and are shown as text, not edited, so the panel reads no storage.
- `src/components/Cockpit.tsx` owns fetching: it unions every panel's needs and asks the
  market store once, from the browser through `/api/proxy` (`src/lib/proxy-fetch.ts`).
  Priced before wiring: the default layout costs 13 calls a load live (7 quotes, a screen
  at 5, one daily history at 1). `DataTable` gained a clickable first cell and a selected
  row, which the cockpit needs and the other two callers do not use.
- Selection: `src/lib/selection.ts` (`nextSelection`, `shownSymbol`, `fromAddress`). Every
  panel config has `follows`, so the layout moved to version 2 with a migration; the quote
  panel follows, the rest stay still. Our fix to the lesson's `shownSymbol`: a following
  panel shows its own symbol until something is selected, instead of nothing. Selecting a
  symbol already on the watchlist costs 0 calls; one from the screen costs a quote, 1 call.
- Break it on purpose works: the selection is written to the address, and read back by an
  effect that runs whenever what the page shows changes — which includes the selected
  symbol. With the no-op removed from `nextSelection`, one click replaces the address
  thousands of times a second and the page stops responding; under `npm run dev` the
  console fills with React's "Maximum update depth exceeded". The Network tab stays quiet
  in mock mode, because the market store answers from its cache. The address is read from
  `window.location` in that effect, not from the render's `searchParams`, which would undo
  a click with the previous symbol.
- Named layouts: `src/lib/layouts.ts` and `src/components/LayoutSwitcher.tsx`; a `layouts`
  document in the store. Switching is state plus `history.replaceState`; switching between
  layouts that share every symbol makes no request. Changes autosave with the version read
  (`src/lib/doc-client.ts`, also used by the notes, screens and shortlist now); a newer
  version from another tab is shown, an unreachable store is said and nothing else breaks.
  Panels are renamed in place. "Revert to saved" restores the copy stored when the layout
  was opened in this page view. Export downloads one layout as JSON.
- States: `src/lib/panel-state.ts`, `failureSentence` in `src/lib/failure.ts` (404 is now
  its own kind, with EODHD's plain-text reason), `src/components/PanelBoundary.tsx`.
  Refreshing keeps the rows with a marker; a failure keeps them, labelled stale; a 402
  offers no retry. A Refresh button asks again even inside the cache's age.
- The heatmap panel, `src/components/panels/HeatmapPanel.tsx` and `src/lib/heatmap.ts`:
  the screen as a squarified treemap, sectors sized by summed market capitalisation, each
  tile coloured and labelled with the day's change, a missing change printed as a dash,
  never 0.0%. Recipe from EodHistoricalData/eodhd-heatmap, `vendor/heatmap.js` (MIT). It
  asks for the same screen as a screen panel with the same filters and sort, so the two
  are one request. A second built-in layout, Markets, is offered beside the saved ones;
  a saved layout of the same name wins.

## Build a Dashboard · unit 3: Alerts, and Reviewing the Whole

- Rules as documents: `src/lib/rules.ts` keeps the field name `ticker` from course 1, adds
  `id`, `enabled`, `lastFiredAt`, `lastValue`, closed lists of fields and operators,
  `parseRules` (drops, never repairs), a pure `evaluate` and `ruleSentence`. The rules are a
  `rules` document in the store, seeded from `RULES` (`src/lib/user-rules.ts`); the home
  page's alert line reads the same document. The course-1 rule tests were rewritten for the
  new shape and keep their cases.
- `src/lib/check-all.ts`: `checkAll(rules, fetchQuotes, now)`, no clock and no fetch inside.
  The dashboard checks after every quotes answer while it is open and says so; the rules'
  symbols join the union, so a check costs nothing extra. `PLAN.md` prices a server doing
  it: 78 calls a day at five minutes, 390 at one minute, against 20.
- Flap control: `cooldownMin`, `rearm`, `armed` and `heldLastCheck` on every rule; with the
  guards on, a crossing rule is its level and hysteresis makes it fire once per crossing.
  `evaluate` takes `{ at, guards }`; without guards it is the plain comparison of the first
  lesson, so its tests stand unchanged. Firings are keyed by rule and observation time and
  a key already seen does not fire; `digest` makes one message of a check's firings.
  `tests/flapping.test.ts`: 8 firings with the guards off, 1 with them on, 0 on a replay.
  Each rule on the dashboard shows the value it last saw and its distance from the
  threshold.
- The review: our own pass in `REVIEW.md`, then a second reader that did not build the
  cockpit wrote `notes/review-cockpit.md`; `REVIEW.md` sorts its findings. Real ones, each a
  failing test commit then a fix commit: the cross-user 404 for layouts and rules
  (`tests/store-scope.test.ts`, which passed as written), collapsing panels (it did not
  exist; a collapsed panel now asks for nothing, `tests/collapse.test.ts`), a store that
  cannot be read (pages answered 500; now `readDoc` and a notice,
  `tests/store-down.test.ts`), and rule tickers checked against the ticker shape. The rest
  are listed with where they will be handled.

## Build a Dashboard · unit 4: Real-Time, and the Wall

- `src/lib/age.ts`: `ageSeconds` and `medianGap` as in the lesson, plus `describeAge` for
  the words. Each quote panel's age is from its own oldest row; the screen and the backtest
  carry a date, so they say "end of day" and the date rather than an age they do not have.
  The header names the oldest quote on screen and, separately, the end-of-day date. A clock
  re-read every 15 seconds keeps the ages counting between fetches.
- `scripts/sample-interval.mjs`: asks the dev server's proxy N times (`--every` seconds
  apart, default 60), prints each timestamp and the median gap; against a real key it
  prints the price and stops unless given `--yes`. It cannot import TypeScript on every
  Node the project supports, so it carries its own median, and `tests/age.test.ts` holds it
  to `medianGap`. Not run live: `PLAN.md` has the two intervals as blanks and says why.
- `src/lib/budget.ts`: `refreshCost`, `exhaustsAt` and `shouldRefresh` as in the lesson.
  The requests are built once: `fetchPlan` and `requestsOf` in `src/lib/proxy-fetch.ts` use
  the same builders as the fetchers, so the price cannot drift from the fetch. The worked
  cockpit is pinned at 18 (19 without the union), the default layout at 13.
- Intervals: `refresh` sits on every panel beside `collapsed` rather than inside each
  type's config, so no panel parser changed; a stored panel without one gets its type's
  default (watchlist and quote every minute, screen every 15 minutes, backtest by hand),
  and a backtest set to anything but by hand is refused, not repaired. "Live" is a minute,
  the resolution of the feed's timestamps, until the measurement says otherwise.
- The loop: a 15-second tick that does nothing while the tab is hidden, sends only the
  symbols whose market is open (US, London, Seoul by their sessions; crypto always; an
  exchange it does not know counts as open; holidays are not known), and runs once when
  the tab comes back. The schedule's price prices each symbol in the fastest interval that
  asks for it; the rules' symbols ride with the fastest.
- The wall: the reserve is the price of one refresh by hand. The first load of the page is
  not held back, because the meter lags and a 402 costs nothing: the API's answer is the
  truth. A 429 waits for Retry-After (at most a minute) and asks once more; a 402 is never
  retried and pauses everything until 00:00 UTC.
- Fixed on the way, from the unit 3 review: the load effect asks only for what was never
  asked for (editing a layout spent calls before, and a symbol the API leaves out would
  have been asked for again on every render), Refresh and Retry are priced and stopped at
  the wall, and Retry no longer re-sends the rules' symbols.
- The exam pass is in `REVIEW.md`, the paragraph in `PLAN.md`.
