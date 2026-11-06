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

Node 20.9 or later; `.nvmrc` pins 22 for `nvm use`. `npm install` also points git at the hooks in `.githooks/` (see [below](#keeping-your-key-out-of-git)).

### Mock mode: work without spending calls

```bash
# in .env.local
EODHD_MOCK=1
```

Restart the dev server. Every request is now answered from the JSON files in `fixtures/`, nothing goes over the network, and no key is needed. The page says it is in mock mode at the top, because invented numbers that look live are worse than none.

Use it while you iterate. The free plan is 20 calls a day and the default page costs 5 per load, so four reloads of a layout you are still adjusting spend the day. Switch it off to check against live data once the code is right. To mock a request the fixtures do not cover, add `fixtures/<endpoint>/<SYMBOL>.json`; `fixtures/README.md` has the details.

### Deploying

The Vercel button above clones this repo and asks for `EODHD_API_KEY` during setup. Nothing else is needed. If you deploy some other way, set the same variable in your host's environment; it must **not** be prefixed `NEXT_PUBLIC_`, or the framework will helpfully ship it to the browser.

## What is already wired

| Path | What it does |
|---|---|
| `src/lib/eodhd.ts` | The only place the API key is read. Server-only. Also where mock mode switches in. |
| `src/app/api/proxy/[...path]/route.ts` | Every market request from the browser goes through here. The rules are in `src/lib/proxy.ts`. |
| `src/lib/cost.ts` | What each endpoint costs in API calls, and `estimateCalls()` to work out a request before you send it. |
| `src/app/api/usage/route.ts` | Your plan, how many calls you have made today, and what one page load costs, as JSON. |
| `src/lib/watchlist.ts` | Your tickers. **This is the file to edit first.** |
| `fixtures/` | What mock mode answers with. |
| `tests/` | The proxy's rules and the cost table, checked by `npm test`. |

Try `/api/proxy/eod/AAPL.US` and `/api/usage` in the browser once it is running.

### Why a proxy at all

Because the alternative is calling EODHD from the browser, which means shipping your key to every visitor. Free keys get scraped from public bundles within days. The proxy exists so that "make it look nice" and "keep the key safe" are not the same decision.

What it does with a request:

- **Forwards only the endpoints the course uses**: `eod`, `real-time`, `div`, `splits`, `fundamentals`, `screener`, `news`, `technical`, `intraday`, `search`, `exchange-symbol-list`. Anything else is a 404 that says so. `/user` in particular is refused: its answer carries your e-mail address, and `/api/usage` already gives you the useful part. Need another endpoint? Add it to `ALLOWED_ENDPOINTS` in `src/lib/proxy.ts`, and its cost to `src/lib/cost.ts`.
- **Drops any `api_token` the caller supplies**, so the browser cannot use your key and cannot substitute another.
- **Passes EODHD's status and body through**, because the body of a 403 is the only place that says which feed your plan is missing. Your key is cut out of any body that echoes it back.
- **Answers a 429 with `Retry-After`** and a sentence saying what happened, rather than an empty table.
- **Sends identical requests that arrive together upstream once.** Two tabs opened at the same moment cost one request, not two.
- **Says what each request cost**, in an `x-eodhd-calls` response header.

### Checking the build does not leak the key

```bash
npm run check:leak
```

Builds the app with a made-up key in the environment, then fails if that value appears in any file the build produces under `.next`, server and browser chunks alike. It also plants the value in `NEXT_PUBLIC_EODHD_API_KEY`, the classic way to ship a key to every visitor by accident. Run it whenever you change how data is fetched; the pre-push hook and CI run it for you.

One thing it deliberately does not scan: `.next/cache`. Since Next.js 16.3 the build cache there records the values of the environment variables your code reads, the key included, so it can tell when to rebuild. That folder is never served and is not what you deploy, but it is a copy of the key on disk. It is gitignored; do not copy the whole `.next` folder to a server.

## Two things the page tells you that most dashboards do not

**How old the numbers are.** Read from the quote's own timestamp, not from the plan name. The plan name is a claim; the timestamp is evidence. The panel says what an age of that size supports: whether you can build an alert on it, or only a report.

**How much of today's quota you have spent.** From the first minute, not from the day you hit the wall. A limit you meet only by hitting it is a limit that breaks your tool without warning, usually on the morning you first rely on it.

### What a page load costs

An API *request* is not an API *call*. Calls are the currency your daily quota is counted in, and endpoints charge different amounts per request: `eod` is 1 however many rows it returns, `fundamentals` is 10, and `real-time` is 1 **per ticker**.

The watchlist is fetched in a single multi-symbol request, and that request costs one call for every ticker in it. The default five tickers are five calls per load, which on the free plan's 20 a day is four reloads. Both the length of the list and how often you reload spend quota. The page shows what one load costs beside the meter, worked out by `src/lib/cost.ts` from the request the page actually sends; reading your plan for the meter is free.

## Building on it

Everything is a server component; there is no client-side JavaScript in the default build. Add some when you need it, and see `PRODUCT.md` for the design decisions already made, including why this page deliberately has no motion and what the rules are if you add any.

### Done means green

```bash
npm test             # the proxy's rules and the cost table; no key, no network
npm run check:leak   # the build does not contain the key
npm run lint
npm run typecheck
```

A change is finished when these pass, not when the page looks right. `npm test` runs in seconds and needs no key, so run it often.

## Using it with Claude Code

The course uses [Claude Code](https://code.claude.com/docs) as its coding agent. This repo is already set up for it:

- `AGENTS.md` (which `CLAUDE.md` imports) gives the agent the rules of this codebase: market data only through the proxy, mock mode while iterating, the cost of a new request stated before it is written, `npm test && npm run check:leak` as the definition of done.
- `.claude/settings.json` stops the agent reading `.env`, `.env.local` and the other files Next.js loads secrets from. It cannot stop a script the agent runs from reading them, so the rule in `AGENTS.md` is the other half.
- `.mcp.json` connects the agent to the [EODHD MCP server](https://eodhd.com/financial-apis/mcp-server), which lets it query the real API while writing your code. That is the difference between wiring that works and wiring that looks plausible.

Install Claude Code by following [the official setup guide](https://code.claude.com/docs/en/setup), then start it in this folder:

```bash
cd academy-dashboard-starter
claude
```

The first time, it asks whether to trust the folder and whether to use the `eodhd` server from `.mcp.json`; say yes to both. Then type `/mcp`, choose `eodhd`, and sign in with your EODHD account in the browser window it opens. The server uses OAuth: **there is no key in `.mcp.json`**, and you should never put one there.

For EODHD's skills and slash commands as well, install the official plugin from inside Claude Code:

```
/plugin marketplace add EodHistoricalData/eodhd-claude-skills
/plugin install eodhd-api@eodhd-claude-skills
```

Its commands are namespaced: `/eodhd-api:eodhd-analyze AAPL`, not `/eodhd-analyze`. The plugin connects the same MCP server; the entry in this repo's `.mcp.json` takes precedence over the plugin's copy, so you sign in once.

**MCP calls spend the same quota.** A question the agent answers through the MCP server is billed in API calls exactly as your app's requests are, against the same daily limit. On the free plan's 20 a day, one fundamentals lookup is half of it. Ask the agent to work on fixtures (`EODHD_MOCK=1`) and to say what a live call will cost before making one.

The prompts the course uses are in [`prompts/`](prompts/).

## Keeping your key out of git

`.env.local` is gitignored. The repo also ships git hooks in `.githooks/`, and `npm install` turns them on (it runs `git config core.hooksPath .githooks`; nothing to copy):

- **pre-commit** refuses a commit staging anything shaped like a key (`scripts/precommit-key-guard.sh`), then lints the staged files.
- **pre-push** runs `npm test`, the type check and `npm run check:leak`, the same checks CI runs on a pull request.

The hooks are a seatbelt, not a lock: they cannot see a key you never staged, and they cannot see one already in your history. If a key does reach a public repo, rotate it. Removing the commit is not enough.

## Licence and data use

The **code** here is MIT. Fork it, change it, ship it.

The **data** is not yours to redistribute. EODHD's own wording is that the packages on the pricing page are *"intended for personal use only as commercial use requires a more thorough approach to licensing and data use"* ([commercial vs personal use](https://eodhd.com/financial-apis/commercial-vs-personal-license-use)). Running this for yourself is personal use. Putting it on a public URL where other people read the numbers, or building it into something you sell, is not, and needs a conversation with EODHD first: support@eodhistoricaldata.com. The [terms](https://eodhd.com/financial-apis/terms-conditions) are the authority, not this paragraph.

Nothing this app displays is investment advice.

## Not affiliated with

Next.js and Vercel, beyond using them. Market data by [EODHD](https://eodhd.com/).
