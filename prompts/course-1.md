# Course 1 prompts: Build Your First Tool

The prompts the lessons of this course ask you to paste, in lesson order, copied from the
lessons themselves. Start Claude Code in this folder with `EODHD_MOCK=1` in `.env.local`,
paste one prompt at a time, and read the plan before you say yes. Each lesson says what a
good answer changes and how to check it yourself.

The reference state at the end of each unit is on the branch `ref/build-your-first-tool/u<unit>` of this
repository: `git fetch upstream`, then `git diff upstream/ref/build-your-first-tool/u1`.

## 1. Write the plan before you write the prompt (unit 1)

Write the plan yourself first, in a scratch file: the five sections above, a purpose sentence that names a real time of day and a real reason, and at least four items under "not building". An agent asked to write your plan writes a generic one. Read the starter's `AGENTS.md` too, all seven rules. Then start the agent in the starter folder, press `Shift+Tab` until the status bar says plan mode on, and paste, with your draft in place of the brackets:

```
Read AGENTS.md, then my draft plan below. Do not edit any file. For
each of the five sections, tell me in one line how I could be wrong
about it, and quote anything too vague to check. For each row of the
data section, name the endpoint and what it costs per page load, using
estimateCalls() in src/lib/cost.ts. Spend no API calls and use no EODHD
tool.

[your draft plan]
```

## 2. Your cockpit — where vibe-coding actually happens (unit 1)

Open the starter in your cockpit and prove it works before you need it. Copy `.env.example` to `.env.local` yourself — the agent is not allowed to — and add `EODHD_MOCK=1` on a line of its own, so nothing here spends a call. Start the agent in the starter folder in manual mode, `claude --permission-mode default`, and paste:

```
Read AGENTS.md first. Then, without changing anything: what does
src/lib/eodhd.ts do, and on which lines is the API key read? Name every
other file under src/ that reads EODHD_API_KEY, and say what each one
does with it. Spend no API calls and use no EODHD tool.
```

## 3. Why your API key must never reach the browser (unit 1)

Mock mode can stay on: the leak check plants its own made-up key and needs neither yours nor the network. In the starter folder, paste:

```
Run npm run check:leak and show me its last line. Then read
scripts/check-leak.mjs and tell me in three sentences what it builds
with, what it searches for, and which folders it deliberately skips and
why. Change nothing, and spend no API calls.
```

## 4. First data on screen, and the meter that shows what it cost (unit 1)

Put `EODHD_MOCK=1` in `.env.local` and restart the dev server. Start the agent in the starter folder and paste:

```
Mock mode is on. Trim WATCHLIST in src/lib/watchlist.ts to three of the
five tickers already in it; ask me which three. Before you edit, tell
me what one page load will cost live, using pageLoadCalls() in
src/lib/quotes.ts, and what ten reloads would cost against the free
plan's 20 calls a day. Change no other file. Run npm test and show me
the diff.
```

## 5. Connect EODHD to your agent (unit 1)

Install the plugin if you want its skills, then type **/mcp**, pick `eodhd` and sign in, as above. Then paste:

```
Before you call any EODHD tool, tell me which one and how many API
calls it will cost, and ask before anything over 5. First question:
what plan am I on, and how many API calls have I used today?
```

## 6. The loop — plan, prompt, diff, read, verify, commit (unit 2)

Run one full turn of the loop on the smallest thing you can find in the starter: change the page heading. Overkill on purpose, because you are practising the motion rather than the change. Write the one-line plan first: what the heading should say, and why. Mock mode on, manual mode, and paste, with your heading in place of the brackets:

```
Plan: the page heading should say what this tool is for. In
src/app/page.tsx, change the h1 text to "[your heading]" and nothing
else. The page stays a server component; if this needs client code,
stop and tell me why before writing anything. Show me the diff before
it lands. Then explain what the page would show if the heading were an
empty string. Spend no API calls. Afterwards run npm test and
npm run lint and show me the last line of each.
```

## 7. Read what your assistant wrote (unit 2)

Take the code above into your own assistant and ask it to review it as someone else's work, before telling it what you found. Paste, with the component in place of the brackets:

```
This component was written for this repository by someone else. Review
it as a stranger's pull request: list every problem, most serious
first, each with the line it is on and what goes wrong for the person
using the page. Then read AGENTS.md and say which of its rules the code
breaks. Do not fix anything, edit no file, and spend no API calls.

[the component from the top of this lesson]
```

## 8. Your tickers, in one request (unit 2)

Mock mode on. Pick the instruments you actually check, including at least one that is not US-listed, and paste:

```
Replace WATCHLIST in src/lib/watchlist.ts with these tickers, in this
order: [your tickers]. Before you edit, tell me what one page load will
cost live with pageLoadCalls() in src/lib/quotes.ts, and which of my
tickers have no row in fixtures/real-time.json. For each of those, add a
row to the fixture in the same shape with invented numbers, so mock mode
shows it. Change no other file, run npm test, and show me the diff.
```

## 9. When the data does not arrive (unit 2)

Mock mode on. Start the agent, press `Shift+Tab` until plan mode is on, and paste:

```
Today quotes() in src/lib/quotes.ts returns null for every failed
answer, so the page cannot tell a rejected key from a spent day. Make
the failure screen say which failure it is and what to do: 401, the key
was not accepted (check it, restart); 402, today's calls are spent (the
count resets at midnight GMT); 429, too many requests this minute (wait,
then reload); anything else, the status code. Plan first and name the
files. Write the tests in tests/failures.test.ts before any code,
stubbing fetch the way tests/proxy.test.ts does, and show me them
failing. No real request: the tests stub the network. Then make them
pass, and run npm test, npm run typecheck and npm run check:leak.
```

## 10. Done means the tests are green (unit 2)

Create `tests/rows.test.ts` with the test above and run `npm test`. Watch it fail. Stage it with `git add tests/rows.test.ts`, so git holds the version you wrote. Put `EODHD_MOCK=1` in `.env.local` and restart, then give your agent the prompt above in Manual mode, with the plan asked for first:

```
Read tests/rows.test.ts and plan the change before writing code: which
files, and how quotes() will use toRows. Then make the test pass: write
toRows in src/lib/rows.ts and use it in quotes(), so the watchlist shows
an unavailable row instead of dropping it. A row with prices but no
volume, like the test's AAPL row, keeps volume as null and the table
shows a dash. Do not edit the test. Mock mode is on; if you need an
unknown symbol in fixtures/ to see the row on the page, add one and
tell me. Run npm test and npm run check:leak and show me both outputs,
then the diff.
```

## 11. Sort by what matters to you (unit 3)

Mock mode on, plan mode on, and paste:

```
Add sorting to the watchlist: my own order from src/lib/watchlist.ts,
change_p, and volume. Put it in a pure function sortRows(rows, key,
order) in src/lib/sort.ts, and add a small control that keeps the
choice in localStorage. The page stays a server component: the control
and the sorted table are one small "use client" island that receives
the rows as props and never fetches. Unavailable rows go last. Plan
first and name the files. Write tests/sort.test.ts before the code: the
input array is not mutated, my order comes from my list rather than
from the response, and two rows tied on change_p come out in the same
order whichever order they arrive in. Show me them failing, then write
the code. No new request. Run npm test and npm run check:leak.
```

## 12. Your own context, next to the numbers (unit 3)

Mock mode on, plan mode on, and paste:

```
Add a note to each watchlist row, stored in localStorage under the key
"watchlist-notes-v1" and keyed by ticker, never by position. Put
loadNotes and saveNotes in src/lib/notes.ts, and the input in a small
"use client" component; the page itself stays a server component. Plan
first and name the files. Write tests/notes.test.ts before the code,
stubbing localStorage with vi.stubGlobal so the test decides exactly
what is stored: loadNotes returns {} when the stored value is not valid
JSON, and a saved note comes back under its own ticker. Show me them
failing, then the code. No API request. Run npm test,
npm run typecheck and npm run check:leak.
```

## 13. Rules that tell you when to look (unit 3)

Mock mode on, plan mode on, and paste:

```
Add threshold rules as data: a Rule type and fires(rule, quote) in
src/lib/rules.ts, and one rule for one of my tickers in
src/lib/my-rules.ts, close enough to its value in mock mode that it
fires. Plan first and name the files. Write tests/rules.test.ts before
the evaluator, against literal quotes: a rule that fires, one that does
not, and a value exactly at the threshold, which does not fire. Show me
them failing, then the code. On the page, a fired rule is a sentence
naming the ticker, the move and my threshold, never a colour alone.
Leave a marked place for one sentence I will write about when rules
are checked. No new request and no timer. Run npm test,
npm run typecheck and npm run check:leak.
```

## 14. From a demo list to the tool you actually use (unit 3)

This is build-time work, which is what the EODHD MCP server is for: your agent searches while you build, and the tool never gets a search box. Paste, with your instruments in place of the brackets:

```
I want my real instruments in src/lib/watchlist.ts. For each company I
name, find its listings with the EODHD search tool and show me the
candidates with exchange and currency, so I choose. Before each search,
tell me what it costs, and ask before more than five. Then replace
WATCHLIST with the tickers I pick, in the order I give, keep the
comment at the top of the file, and tell me what one page load will
cost live. Change no other file and show me the diff.

My instruments: [company names, including any you suspect may not be covered]
```

## 15. How old is this number, really? (unit 4)

The starter already prints a data-age line with its band. Read how it decides first: `ageMinutes()` in `src/lib/quotes.ts` takes the **newest** row. With a list that mixes markets, one fresh row — a crypto pair at the weekend, a market still open — makes the whole page look live while another row is a day old. Mock mode on, plan mode on, and paste:

```
The data-age panel uses ageMinutes() in src/lib/quotes.ts, which
reports the newest row, so one fresh market can vouch for a stale one.
Change it to report the oldest row, make asOf in src/app/page.tsx take
the same row, and say "oldest number on this page" in the panel. Plan
first and name the files. Write tests/age.test.ts before the code, with
literal timestamps and a fixed now: rows one minute and two days old
give 2880, and a row stamped after now gives 0, never a negative age.
Show me the first test failing, then the code. No request. Run
npm test, npm run typecheck and npm run check:leak.
```

## 16. The wall — where your tool stops being enough (unit 4)

Measure first, with mock mode off. Open the usage route, `localhost:3000/api/usage`, which costs nothing, and note `used`. Reload the watchlist once, wait a few seconds for the counter to catch up, and open the usage route again. Then paste, with your numbers in place of the brackets:

```
I measured on my own account: used went from [before] to [after] for
one page view, my daily limit is [limit], and my data age from the last
lesson was [minutes]. Show the arithmetic: cost per view, views my
allowance buys per day, and what a page that refreshes once a minute
for a 6.5-hour session would cost. Then add four lines to PLAN.md next
to the definition of done, with my numbers: Cost per view, Views my
allowance buys, My data age, What I cannot build. Leave the last one
empty for me. Change no other file and make no request.
```

## 17. Fork it, deploy it, own it (unit 4)

Before the wizard, let the agent check that the repository is ready. Paste:

```
I am about to deploy this repository to Vercel. Do not deploy anything
and do not read any env file. Run npm test, npm run typecheck,
npm run lint and npm run check:leak and show me the last line of each.
Then list every environment variable the code reads, and say which one
the host needs, which one must never be set there, and confirm that
none is prefixed NEXT_PUBLIC_. Finally, search src/ for any request
that does not go through eodhdFetch or the proxy route, and show me
what you found.
```
