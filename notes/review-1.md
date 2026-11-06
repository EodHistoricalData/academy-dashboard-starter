# Review 1

The last two commits (sortByMove, and the page ordered by it), reviewed against AGENTS.md
and PLAN.md by a fresh session. One round; each finding has a verdict: real, taste or wrong.

```
src/lib/move.ts:6 — sorts by size only; a +3 and a -3 tie, and tie order is the
  watchlist's. TASTE: intended, and a test already pins it.
src/app/page.tsx:45 — a row with no change_p would sort as NaN. WRONG: quotes()
  drops rows whose change_p is not a number before they reach the page.
tests/move.test.ts — no test that the sort is stable for three or more equal
  moves. REAL: test added, red on a hand-written unstable sort, green on ours.
```

The unstable sort used to see the new test fail was a selection sort that swaps across
equal rows. The existing tests all passed on it; the new one did not.
