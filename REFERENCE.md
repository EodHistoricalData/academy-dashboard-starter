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
