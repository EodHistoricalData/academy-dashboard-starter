# Second reader's review of the cockpit against REVIEW.md, 2026-11-06

## Leaks

- `src/app/api/store/[key]/route.ts:22-23` — your question: another user's document answers 404, same body as a missing one. GET reads only the caller's row (`store.ts:61-62`, user is the first argument). Fine.
- `tests/store.test.ts:49-54` — the 404 is proven for `saved-screens` only. `layouts` and `rules` take the same path, but nothing would fail if a later route change broke them. Your own note says so.
- `src/lib/rules.ts:63` — a rule's `ticker` is only checked to be a string; layouts use `isTicker` (`layout.ts:85,103,130`). The ticker goes unchanged into the request path and `s` list (`quote-request.ts:12`, `Cockpit.tsx:227-228`). A stored rule with `?` or `&` in it adds query parameters to a call made with your key. The proxy rejects `?` in path segments (`proxy.ts:198-203`) but I did not see a per-symbol check on the `s` list; verify it.
- `src/app/api/store/[key]/route.ts:56` — the PUT stores any JSON for `rules`. The only check is on read (`user-rules.ts:11`). Fine for now, but the check must stay the only way a rule is read.
- `src/lib/user.ts:23` — mock mode without a password makes everyone user 1. Fine for the course, and the page says so.

## Cost

- Collapsing a panel: it does not exist. No collapse state or button in `Cockpit.tsx` or `PanelFrame`; `needsByPanel` (`Cockpit.tsx:153-160`) is built from every panel in the layout. So "a collapsed panel adds nothing" has no code to test. Your note at REVIEW.md:96-98 says this correctly.
- `src/components/Cockpit.tsx:227-228` — rule tickers are added to every fetch, so a rule costs a symbol even on a layout with no quote panel. Any collapse feature will have to treat these separately from `unionNeeds` (`panels.ts:48`).
- `src/components/Cockpit.tsx:430` — "Retry this panel" calls `fetchFor([needs], true)`, which also adds the rule symbols (line 228) and forces them. Retrying a failed screen panel re-spends a quotes request that was fine.
- `src/components/Cockpit.tsx:385` — Refresh forces everything, with no limit. About 13 calls a click on the default layout; two clicks spend a free day of 20.
- Switching layouts: `switchTo` (`Cockpit.tsx:314-319`) is state only, and `fetchFor` runs with `force=false` (line 280). Nothing cached and fresh is refetched. But "cached" means younger than 60 s for quotes (`:136`), 5 min for screens, 1 h for bars. A switch after a minute refetches the quotes; it is not "nothing cached".
- `src/lib/market-store.ts:36,54` — a symbol the response omits is never cached, so it is asked for again on every `quotes()` call (each layout switch, selection change, rule check). A typo'd ticker costs a request each time.
- `src/lib/layout.ts:79,84` — the cap is 30 symbols per panel but no cap on panels or on the union. `unionNeeds` has no ceiling, so one request can grow with the layout (and past URL length).
- `src/components/Cockpit.tsx:260` — `void runChecks()` is not awaited and its quotes call can reject unhandled if the fetch fails.

## Lies

- `src/components/Cockpit.tsx:521` — the age uses `data.quotes[0].fetchedAt` against the oldest quote time. Rows cached at different moments have different fetch times, so the "N min old" can be wrong by the gap between them. `Math.max(0, …)` also hides a negative age.
- `src/lib/check-all.ts:85` — the digest line prints the time the check ran, in UTC. It reads as the time of the quote; on a closed market the price is days old and the line looks current.
- `src/lib/rules.ts:155,165` — "two checks in a row" counts two reads of the same observation (reload twice on the same quote). The debounce is meant to remove one-tick noise, and the check has no way to know it saw the same tick twice (the `key` dedup, line 167, lives only in a ref, `Cockpit.tsx:124`).
- `src/lib/rules.ts:56-57` — a non-array "rules" document returns `[]`, so the page says "No rules yet." when the document is damaged.
- `src/lib/layouts.ts:15` — a layout named `__proto__` sets the prototype instead of an own key; the layout vanishes silently and the default opens.

## Failure

- Cockpit with the store unreachable: it does not draw. `src/app/dashboard/page.tsx:26,29` and `src/lib/user-rules.ts:10` call `getDoc` with no try/catch. `store.ts:50-51` (open the file) and `store.ts:80` (`JSON.parse`) throw, so the page returns a 500 before the Cockpit exists. Only a failed save after load is handled (`Cockpit.tsx:306-309`). `app/page.tsx:27` and `screen/page.tsx:57-58` fail the same way.
- `src/components/Cockpit.tsx:218-222` — a failed save of the rules is dropped without a word, and a conflict updates the version but not the rules. The next write then overwrites the other tab, which is the thing the version exists to stop. The layout path (`:299-304`) shows it; this path does not.
- `src/lib/layout.ts:192` — a panel id missing or repeated gets no uniqueness check, so two panels share a React key (`Cockpit.tsx:398,418`) and rename (`:326`) changes both.
- `src/app/api/store/[key]/route.ts:56` — `putDoc` is not in a try; a locked or read-only database answers a bare 500. The client copes (`doc-client.ts:28`), but the message "did not answer" is then not distinguishable from a refusal.
- `src/lib/market-store.ts:47-48` — fine: a failed fetch clears `pending` in `finally` (line 38), and rows already on screen stay (`Cockpit.tsx:432`).

## Weakest lens

Failure. The checklist's failure line (REVIEW.md:38-39) is written for the screener's no key, refused filter, spent day and empty result, and the cockpit pass (line 100-101) says a store that does not answer leaves the cockpit drawing. That holds for saving only. The first read on the server has no guard, and the rules save fails without a message. Cost is next: it names the union and the cache, but not Refresh, Retry and the rule symbols that ride every request.
