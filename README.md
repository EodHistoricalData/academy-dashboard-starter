# Market tool starter

A small Next.js app that reads live market data from the [EODHD APIs](https://eodhd.com/financial-apis/) and keeps your API key on the server, where it belongs.

It ships as a working watchlist. That is not the point of it. The point is that the parts which are annoying to get right, and dangerous to get wrong, are already right, so the first thing you build on top of it is your tool rather than a key leak.

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https%3A%2F%2Fgithub.com%2FEodHistoricalData%2Facademy-dashboard-starter&env=EODHD_API_KEY&envDescription=Your%20EODHD%20API%20key.%20It%20is%20read%20on%20the%20server%20and%20never%20sent%20to%20the%20browser.&envLink=https%3A%2F%2Feodhd.com%2Fregister)

---

## Run it

```bash
git clone https://github.com/EodHistoricalData/academy-dashboard-starter
cd academy-dashboard-starter
npm install

cp .env.example .env.local     # then put your key in EODHD_API_KEY
npm run dev
```

Open http://localhost:3000. If the key is missing the page says so and tells you what to do; it does not render an empty table and leave you guessing.

A free key is at [eodhd.com/register](https://eodhd.com/register).

### Deploying

The Vercel button above clones this repo and asks for `EODHD_API_KEY` during setup. Nothing else is needed. If you deploy some other way, set the same variable in your host's environment; it must **not** be prefixed `NEXT_PUBLIC_`, or the framework will helpfully ship it to the browser.

## What is already wired

| Path | What it does |
|---|---|
| `src/lib/eodhd.ts` | The only place the API key is read. Server-only. |
| `src/app/api/proxy/[...path]/route.ts` | Every market call goes through here. Any `api_token` the caller supplies is dropped, so the browser cannot use your key and cannot substitute another. |
| `src/app/api/usage/route.ts` | Your plan and how many calls you have made today, as JSON. |
| `src/lib/watchlist.ts` | Your tickers. **This is the file to edit first.** |

Try `/api/proxy/eod/AAPL.US` and `/api/usage` in the browser once it is running.

### Why a proxy at all

Because the alternative is calling EODHD from the browser, which means shipping your key to every visitor. Free keys get scraped from public bundles within days. The proxy exists so that "make it look nice" and "keep the key safe" are not the same decision.

The build is checked for this: running the production build with the key in the environment, the key's value appears in no file under `.next`, client chunks included. Worth re-checking if you change how data is fetched.

## Two things the page tells you that most dashboards do not

**How old the numbers are.** Read from the quote's own timestamp, not from the plan name. The plan name is a claim; the timestamp is evidence. The panel says what an age of that size supports: whether you can build an alert on it, or only a report.

**How much of today's quota you have spent.** From the first minute, not from the day you hit the wall. A limit you meet only by hitting it is a limit that breaks your tool without warning, usually on the morning you first rely on it.

The whole watchlist costs **one** API call regardless of length, because quotes are fetched in a single multi-symbol request. What burns quota is how often you reload, not how many tickers you watch.

## Building on it

Everything is a server component; there is no client-side JavaScript in the default build. Add some when you need it, and see `PRODUCT.md` for the design decisions already made, including why this page deliberately has no motion and what the rules are if you add any.

If you use an AI assistant, point it at the [EODHD MCP server](https://eodhd.com/financial-apis/mcp-server) first. It lets the assistant query the real API while writing your code, which is the difference between wiring that works and wiring that looks plausible.

## Keeping your key out of git

`.env.local` is gitignored. There is also a pre-commit hook that refuses a commit staging anything shaped like a key:

```bash
cp scripts/precommit-key-guard.sh .git/hooks/pre-commit && chmod +x .git/hooks/pre-commit
```

It is a seatbelt, not a lock: it cannot see a key you never staged, and it cannot see one already in your history. If a key does reach a public repo, rotate it. Removing the commit is not enough.

## Licence and data use

The **code** here is MIT. Fork it, change it, ship it.

The **data** is not yours to redistribute. EODHD's own wording is that the packages on the pricing page are *"intended for personal use only as commercial use requires a more thorough approach to licensing and data use"* ([commercial vs personal use](https://eodhd.com/financial-apis/commercial-vs-personal-license-use)). Running this for yourself is personal use. Putting it on a public URL where other people read the numbers, or building it into something you sell, is not, and needs a conversation with EODHD first: support@eodhistoricaldata.com. The [terms](https://eodhd.com/financial-apis/terms-conditions) are the authority, not this paragraph.

Nothing this app displays is investment advice.

## Not affiliated with

Next.js and Vercel, beyond using them. Market data by [EODHD](https://eodhd.com/).
