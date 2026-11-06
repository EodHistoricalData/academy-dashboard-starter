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
- A search box for adding tickers.
- Not yet: notes on symbols (course 1, unit 3).

## Done

Deployed at a URL, showing my tickers with live-ish prices and change, readable on my
phone, without my API key appearing anywhere in the browser: no request to `eodhd.com`
in the network tab, and `npm run check:leak` green.

## Riskiest unknown

The API key must never reach the browser. Every market request goes through the
server-side proxy, and nothing reads the key outside `src/lib/eodhd.ts`.
