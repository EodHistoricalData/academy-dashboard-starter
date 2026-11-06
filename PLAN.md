# Plan: my watchlist

## Purpose

A page I open at 7am, before the US open, that tells me for the instruments I hold or
want to hold what moved since the last close and by how much, so I know which ones to
read about before the market opens.

## Data, per thing on screen

| On screen | The question | Endpoint |
|---|---|---|
| Last price | What is it trading at now? | `/real-time/{ticker}` |
| Change since yesterday | How far did it move? | same call, `change` and `change_p` |
| Data age | How old is that price? | same call, `timestamp` |
| Calls used today | How close am I to the limit? | `/user` (free, read on the server) |

## Not building

- User accounts or a login.
- A database. The list is a file in the repo.
- Charts. Not even a sparkline yet.
- Alerts that push to my phone.
- A search box for adding tickers. I find a ticker once with `/search` and paste it in.
- Notes that sync between devices: they stay in this browser for now.

## Added in unit 3

- A sort I choose (as written, change %, volume) that survives a reload.
- A note per ticker: why I am watching it. Kept in this browser, never in git.
- One threshold rule, checked when the page loads and said to be checked only then.

## The wall, in my numbers

```
Cost per view:            7 calls (one per ticker; reading the meter is free)
Views my allowance buys:  2 per day (20 calls / 7, rounded down)
My data age:              7 days on the fixtures; live, measure it in market hours,
                          an hour after the close and on a weekend
What I cannot build:      a page I can leave open that keeps itself current
```

My routine is about 15 views a day: 105 calls, five times the free allowance. A page that
refreshes once a minute through a 6.5-hour session is 390 views, 2,730 calls. And the MSFT
rule fires as late as the data is old, whatever I spend.

## Done

Deployed at a URL, showing my tickers with live-ish prices and change, readable on my
phone, without my API key appearing anywhere in the browser: no request to `eodhd.com`
in the network tab, and `npm run check:leak` green.

## Riskiest unknown

The API key must never reach the browser. Every market request goes through the
server-side proxy, and nothing reads the key outside `src/lib/eodhd.ts`.
