## Alert budget

- Symbols: 2 (AAPL.US, NVDA.US), one end-of-day request each.
- Calls per run: 2.
- Runs I allow myself: one scheduled run a day, and two by hand: 6 calls.
- Reserve: 14 of the free plan's 20, for the page and the MCP server.

## Alert schedule

17:30 in New York on weekdays: 21:30 UTC in summer (EDT), 22:30 UTC in winter (EST).

## Alert delivery

Telegram: a rare duplicate is accepted, a missed alert is not. Send, then record; the Bot
API has no idempotency key, so a run that dies between the two sends again next time.

## Clock cases

- 21:30 UTC on 2026-07-14 is trading date 2026-07-14: 17:30 in New York, summer time.
- 22:30 UTC on 2026-01-14 is trading date 2026-01-14: 17:30 in New York, winter time.
- 01:00 UTC on 2026-01-15 is trading date 2026-01-14.
- 15:00 UTC on 2026-01-17 has no trading date, and the run fetches nothing.
- A run with every symbol already processed today spends 0 calls.
- A 5xx is retried after 1 second and then 2; a 402 is not retried.
