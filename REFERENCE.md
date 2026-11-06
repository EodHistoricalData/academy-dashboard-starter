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
