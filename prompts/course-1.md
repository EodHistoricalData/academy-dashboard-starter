# Course 1 prompts

Start Claude Code in this folder with `EODHD_MOCK=1` in `.env.local`, so nothing here spends
your API calls until you decide it should.

## 1. Find your way around

```
Read AGENTS.md and README.md, then explain in five sentences how a price gets from
EODHD to the table on the home page. Name the files it passes through. Do not change
anything.
```

## 2. Write a test before you change anything

```
Before we change the watchlist, add a test in tests/ that checks what quotes() in
src/lib/quotes.ts returns for the default watchlist in mock mode: one row per ticker,
in the same order. Run npm test and show me it passes. Then commit it.
```

## 3. Add a column

```
In the watchlist table, split the Ticker column in two: Ticker shows AAPL, and a new
Exchange column next to it shows US, for AAPL.US. Use the data the page already
fetches, so the cost per load does not change; tell me if you think it would. Keep the
styling of the existing columns. Run npm test and npm run check:leak, then commit.
```

## 4. Know what a reload costs

```
The page shows what one load costs in API calls. Using estimateCalls() in
src/lib/cost.ts, tell me what it would cost if I added three more tickers to
src/lib/watchlist.ts, and how many reloads a day that leaves on the free plan's 20 calls.
Then add the three tickers I name next, and check the number on the page matches.
```
