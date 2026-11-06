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
