# Review checklist

Run on every diff, and once more on a whole feature before calling it done. The order is
worst consequence first. Review what changed, then whether the whole still makes sense.

## 1. Leaks

Can a secret escape? Can a caller reach something they should not? Does a person's input
reach a request made with my key?

*Screener:* the proxy forwards query parameters. Does it drop `api_token` by name rather
than by luck of line order, rebuild the `filters` from the allowlist, clamp `limit`, and
send back only the fields the table needs, never the upstream body as it came?

## 2. Cost

How many API calls does this make, what does that number grow with (rows, keystrokes,
renders, open tabs), and is the data already in a response I have?

*Screener:* one page view is one `/screener` request, 5 calls. A per-row fetch for a sector
or a profile turns that into 5 + 10 a row; the screener already sends `sector` and
`industry`. No timer: the screen runs on the last completed session.

## 3. Lies

Is any number in units it is not in? Can a missing value render as zero? Are two currencies
in one column?

*Screener:* `dividend_yield` is a fraction (0.0002 is 0.02%). Market cap is unreadable in
full; format it for reading and sort on the raw value. A float like 0.98999999999995 is
rounded at the column. A missing yield is a dash.

## 4. Failure

What does a person see when this breaks: no key, a refused filter, a spent day, no
results? Is a partial result kept or thrown away?

*Screener:* a refused filter names its path ("Filter 1, field"); no key says which file to
fix; a 402 says the day is spent; an empty screen says nothing matched.

## How to write a finding

Name the problem and its consequence, not the keystroke: "This forwards `limit` straight
upstream, so anyone can ask for 500 rows against my key", not "add Math.min".

## Findings, and the test each one became

Unit 3 of Build a Screener, run on the screener as unit 2 left it:

- Leaks: the proxy returned the screener's body as it came. Now it returns the table's
  fields only (`tests/proxy.test.ts`, "returns only the fields the table needs").
- Leaks: with the key removed, the proxy said "Could not reach EODHD", which sends you
  looking at the network. Now it says the key is not set (`tests/proxy.test.ts`).
- Cost: nothing had a number on it. `tests/cost.test.ts` now prices the screen page at 5.
- Lies: market cap was printed in full, 4,551,000,000,000. Now 4.55T, sorted on the raw
  value upstream (`tests/format.test.ts`).
- Lies: the yield conversion lived in a column, untested. Now `asPercent` in
  `src/lib/format.ts`, tested on 0.0002.

## A reader who did not write it

On a branch, with a pull request open, in a fresh session (or another model) that carries
nothing from the one that wrote the change:

```
Review the diff of this branch against main as code you did not write. Use the four
lenses in REVIEW.md: leaks, cost, lies, failure. List each problem with the line it is on
and what it would cost. Do not fix anything.
```

Sort what comes back into real (a line and a consequence you can reproduce: failing test
first, then the fix), plausible and wrong (check, then discard), and taste (ignore unless it
would have prevented a bug). CI on the pull request decides what merges.

## Feature pass before shipping the two pages together

- Leaks: the add-to-watchlist value reaches a request made with the key, so the server
  action checks it against the ticker shape, and so does every read of the cookie
  (`tests/added.test.ts`). The network check now covers both pages.
- Cost: each name added from the screen is one more call on every watchlist load; capped at
  ten, and counted by the meter and `/api/usage`.
- Lies: nothing on the screen says "pick" or "signal"; it says the rows match the filters,
  and the shortlist says it is not a recommendation.
- Failure: the loading skeleton had no navigation, so the page jumped when data landed; it
  carries the same two links now.

## The cockpit, reviewed whole (Build a Dashboard, unit 3)

My own pass, before any second reader:

- Leaks: every store read and write goes through `currentUser()` and takes the user first
  (`src/lib/store.ts`); a cross-user GET is a 404 in `tests/store.test.ts`, but only for
  saved screens, not for layouts. The layout export holds names, titles, symbols and
  filters: nothing private today, and it would carry anything a config ever holds.
- Cost: one union of needs per load (13 calls live on the default layout). Switching
  layouts asks for nothing cached. A panel cannot be collapsed yet, so the question "does
  a collapsed panel still cost" has no answer in the product: every panel always costs.
- Lies: the home page's time is the oldest quote; each panel shows its own age from the
  data's dates. The quote panel prints the last trade time.
- Failure: a store that does not answer leaves the cockpit drawing and says the layout was
  not saved; one panel's crash stays in that panel.

### The second reader's findings, sorted

`notes/review-cockpit.md` is the review of a session that did not build the cockpit. Each
finding marked real gets a failing test first and its fix second, a commit each.

Real, fixed here:
- The cross-user 404 was tested for saved screens only; layouts and rules now too.
- Collapsing a panel did not exist, so every panel always cost: a collapsed panel now adds
  nothing to the union.
- A store that cannot be read made the dashboard, the home page and the screen page answer
  500 before anything drew. The first read is now guarded, and the page says what failed.
- A stored rule's ticker was not checked against the ticker shape before it reached a
  request path.

Real, left for the refresh-budget unit, where they belong: Refresh and Retry force every
request with no limit, and Retry re-asks for quotes that did not fail; a symbol the API
omits is never cached; the age next to a panel uses one row's fetch time. Real and small,
noted for later: a failed or conflicting save of the rules is silent; duplicate panel ids;
a layout named `__proto__`; a damaged rules document reads as "no rules yet".

Plausible, but not as stated: the digest's time is the time of the check, which is when the
rule fired; the debounce counting a reload of the same tick twice is a real gap in the
model and is written down rather than fixed.

Weakest lens, as the reader said: failure, on the server's first read.

## Before the exam, 2026-11-09 (Build a Dashboard, unit 4)

All five panel states forced by hand in mock mode, the answers held or replaced in the
browser's network layer:

- Loading (every answer held): each panel shows grey bars and "Loading…", nothing blank.
- Refreshing (Refresh pressed, answers held): the rows stay, the title says "10 days old ·
  refreshing…".
- Ready: rows, and the age from the quotes' own timestamps; the header names the oldest.
- Empty (the screen answered `[]`): "Nothing matches these filters." in the panel.
- Failed (the quotes answered 500): "EODHD answered 500, a fault on its side", with Retry.
  With a 402 instead: "You are out of API calls for today (402)", no Retry, the rows kept
  and labelled stale, and the cockpit's own line "Refresh paused: … resets at 00:00 UTC".

Against the lenses:

- Leaks: unchanged since unit 3; the budget reads `/api/usage`, which returns only the
  meter fields.
- Cost: the price on screen comes from `refreshCost` over the same requests the fetchers
  send, and a test pins it (13 on the default layout). Editing a layout no longer spends
  anything; the loop is the only thing that refreshes old data, and it stops a refresh by
  hand short of the limit.
- Lies: each panel's age is from its own data; the quote fixture is ten days old and the
  page says so, rather than looking current.
- Failure: a 402 is never retried, a 429 waits for its Retry-After once.

Where the product felt wrong although the list passed: an empty screen has no age or state
in its title bar, only the sentence in the body; and the budget line is one long sentence
that is easy to skip. Both written down, neither changed: the checklist did not ask for
them, which is the point of reading the product and not only the list.
