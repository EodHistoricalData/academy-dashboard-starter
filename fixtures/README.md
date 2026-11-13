# Fixtures

What the app answers with when `EODHD_MOCK=1` is set. Nothing here is market data except
where the table says so: the numbers are invented, in exactly the shape EODHD returns, so
the code that reads them is the same code that reads the real thing.

| File | Answers |
|---|---|
| `real-time.json` | `real-time/...` for the default watchlist. A ticker not in the file comes back with every field `"NA"`, the way EODHD answers for a symbol it has never seen traded. |
| `eod/AAPL.US.json` | `eod/AAPL.US`, ten daily bars. `filter=last_close` gives the last close. |
| `eod/SPY.US.json` | `eod/SPY.US`, one year of daily bars (2025-10-31 to 2026-10-30), the depth of the free plan, for the backtester. Four dividends are in `adjusted_close`. `from` and `to` are ignored. |
| `div/SPY.US.json` | `div/SPY.US`, the four dividends already folded into the SPY bars' `adjusted_close`, in the shape /div returns (`unadjustedValue` is the cash paid; `value` is the same here, with no split since). |
| `splits/SPY.US.json` | `splits/SPY.US`, an empty array: the invented year has no split. |
| `fundamentals/AAPL.US.json` | `fundamentals/AAPL.US`, a few sections of the real document. `filter=General::Name` works. |
| `user.json` | Your plan and today's count, for the meter on the page. |
| `screener.json` | `screener`, twenty rows under `data` as the real endpoint wraps them. The same answer whatever the filters, sort or limit: the mock does not screen. |
| `sentiments.json` | `sentiments?s=...`, a real answer of 2026-11-13, not invented: AAPL.US, MSFT.US and NVDA.US with 31 days each, VOD.LSE with 7 days and 8 articles in all. Only the asked symbols come back; one with no days is left out, and when none has any the answer is `[]`, an empty array, as the API sends it. `from` and `to` narrow the days. |

To mock another request, add a file at `fixtures/<endpoint>/<SYMBOL>.json`. A request with
no file gets a 404 naming the path it looked for.

Mock mode spends no API calls and needs no key. Use it while you iterate on layout and
logic; switch it off to check against live data once the code is right.
