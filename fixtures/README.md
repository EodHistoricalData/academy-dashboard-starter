# Fixtures

What the app answers with when `EODHD_MOCK=1` is set. Nothing here is market data: the
numbers are invented, in exactly the shape EODHD returns, so the code that reads them is
the same code that reads the real thing.

| File | Answers |
|---|---|
| `real-time.json` | `real-time/...` for the default watchlist. A ticker not in the file comes back with every field `"NA"`, the way EODHD answers for a symbol it has never seen traded. |
| `eod/AAPL.US.json` | `eod/AAPL.US`, ten daily bars. `filter=last_close` gives the last close. |
| `eod/NVDA.US.json` | `eod/NVDA.US`, ten daily bars whose last two closes cross 185, so the alert in `alerts/rules.json` fires once in mock mode. |
| `fundamentals/AAPL.US.json` | `fundamentals/AAPL.US`, a few sections of the real document. `filter=General::Name` works. |
| `user.json` | Your plan and today's count, for the meter on the page. |

To mock another request, add a file at `fixtures/<endpoint>/<SYMBOL>.json`. A request with
no file gets a 404 naming the path it looked for.

Mock mode spends no API calls and needs no key. Use it while you iterate on layout and
logic; switch it off to check against live data once the code is right.
