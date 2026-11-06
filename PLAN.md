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
- 00:30 UTC on 2026-07-15, the 20:30 catch-up run in summer, is trading date 2026-07-14.

## Alert heartbeat

Last commit: 2026-11-06. GitHub disables a public repository's schedules after 60 days with
no activity: 2027-01-05. The heartbeat check would say so the evening after.

## Alert: stay, change the question, or upgrade

`npm run alert:cost` for 2 symbols: end of day 2 calls a day, live quotes every 15 minutes
52, intraday bars every 15 minutes 260, against 20.

- Would I act during the session? No: I act the next morning.
- Has the alert changed a decision yet? Not yet: it has run for days, not a month.
- Is the limit speed or breadth? Neither: two symbols once a day use 2 of 20 calls.

Decision: stay on end of day, on the free plan. Ask again after a month of alerts.
