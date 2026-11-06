<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

## Rules for working in this repo

The person you are working for is learning. They have 20 API calls a day on the free plan and a key they must not leak. These rules protect both.

1. **All market data goes through the proxy.** Server code calls `eodhdFetch()` in `src/lib/eodhd.ts`; browser code calls `/api/proxy/...`. Never call `eodhd.com` from anywhere else, and never from the browser. A new endpoint goes into `ALLOWED_ENDPOINTS` in `src/lib/proxy.ts` and its price into `src/lib/cost.ts`, in the same change.
2. **Never read, print or edit `.env`, `.env.local` or any other env file**, and never echo the key in a command, a log line or a test. If you need to know whether a key is set, ask the person. Use `.env.example` to see which variables exist.
3. **Never put the key in a `NEXT_PUBLIC_` variable**, in `env` in `next.config.ts`, or in a `"use client"` file. Anything there is shipped to every visitor's browser.
4. **Work on fixtures.** Use `EODHD_MOCK=1` while iterating; it costs no calls and needs no key. Go live only to check the finished change, and say so before you do.
5. **State the cost before you write a fetch.** Before adding or changing any request to EODHD, say how many API calls it spends per page load (use `estimateCalls()` in `src/lib/cost.ts`) and wait for a yes if it is more than a handful. The same goes for questions you answer through the EODHD MCP server: they spend the same quota.
6. **Done means green:** `npm test && npm run check:leak` pass, plus `npm run lint` and `npm run typecheck`. A page that looks right is not done. A behaviour change comes with a test in `tests/`; write the test first when you can.
7. **Small steps, one commit each.** One change, its test, a commit with a plain message, then the next. Never `--no-verify`: if a hook fails, fix what it found.

## Traps found in this repo

**Do not write HTML entities in JSX text.** `<code>x</code> &mdash; y` renders as
`x— y`: the compiler's entity decoding swallows the space in front of the entity, and
Prettier will keep reverting an explicit `{" "}` because it considers the plain space
significant. Write the character itself — `—`, `·`, `’` — and the space survives. This
cost a build-verify cycle to find; it is invisible in review and obvious on screen.

**`real-time` answers in two shapes.** One ticker gives a bare object, two or more give an
array. `quotes()` in `src/lib/quotes.ts` handles both; code that assumes an array breaks the
day the watchlist is trimmed to one.

## My rules

- Keep a change under 100 changed lines. If it needs more, split it and tell me how.
- When two approaches are both reasonable, show me both in three lines each and wait.
- Commit messages say why, not what: one line, present tense, never "update".
- Ask before touching anything in .github, .githooks or scripts.
- Before any code, say in one sentence what the change does and which files it touches.
- Read PLAN.md before proposing any change. Anything it does not cover is out of scope: ask before doing it.
