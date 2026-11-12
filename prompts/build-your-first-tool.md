<!-- Generated from the lessons of Build Your First Tool by scripts/sync_starter_prompts.py in the academy repository. Edit the lesson and run the script; an edit here is overwritten. -->

# Build Your First Tool prompts

The prompts the lessons of this course ask you to paste, in lesson order, copied from the lessons themselves with the lines that say where and how to paste them. Start your agent in this folder, with `EODHD_MOCK=1` in `.env.local` unless the lesson says otherwise, paste one prompt at a time, and read the plan before you say yes. Each lesson says what a good answer changes and how to check it yourself.

The reference state at the end of each unit is on the branch `ref/build-your-first-tool/u<unit>` of this repository. If you cloned the starter, it is your `origin`: `git fetch origin`, then `git diff origin/ref/build-your-first-tool/u1`. If your copy points at a repository of your own, [README.md](README.md) says how to add the starter as `upstream`.

## 1. Write the plan before you write the prompt (unit 1)

Write the plan yourself first, in a scratch file: the five sections above, a purpose sentence that names a real time of day and a real reason, and at least four items under "not building". An agent asked to write your plan writes a generic one. Read the starter's `AGENTS.md` too, all seven rules. Then start the agent in the starter folder, press `Shift+Tab` until plan mode shows under the prompt, and paste, with your draft in place of the brackets:

```
Read AGENTS.md, then my draft plan below. Do not edit any file. For
each of the five sections, tell me in one line how I could be wrong
about it, and quote anything too vague to check. For each row of the
data section, name the endpoint and what it costs per page load, using
estimateCalls() in src/lib/cost.ts. Spend no API calls and use no EODHD
tool.

[your draft plan]
```

Keep the comments you agree with, then paste:

```
Save my plan as PLAN.md, in my words plus only the changes I accepted.
If PLAN.md already holds lines I wrote earlier: my new purpose sentence
replaces a practice Purpose line, my Data rows go in beside a
development-budget line, a Status section stays as it is, and every
section gets my plan's content. If AGENTS.md does not already point at PLAN.md, add
this line above the numbered rules: "Read PLAN.md before starting any change, and say so if
a request is not in it." Change nothing else, and show me the diff.
```

## 2. Your cockpit — where vibe-coding actually happens (unit 1)

Open the starter in your cockpit and prove it works before you need it. Copy `.env.example` to `.env.local` yourself — the agent is not allowed to — with `cp .env.example .env.local` (in PowerShell: `copy .env.example .env.local`), open the new file in your editor and add `EODHD_MOCK=1` on a line of its own, so nothing here spends a call. (If you did Pair With Your Agent, the file exists already; check that it has the `EODHD_MOCK=1` line. A real key is not needed until lesson 4, which says where to get one.) Start the agent in the starter folder in its learning mode — `claude --permission-mode manual`, or `codex --sandbox read-only --ask-for-approval on-request` — and paste:

```
Read AGENTS.md first. Then, without changing anything: what does
src/lib/eodhd.ts do, and on which lines is the API key read? Name every
other file under src/ that reads EODHD_API_KEY, and say what each one
does with it. Spend no API calls and use no EODHD tool.
```

Then, as a second message:

```
Show me what is in .env.local.
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
plan's 20 calls a day. If a comment in that file says how many tickers
or calls there are, make it true. Change no other file. Run npm test
and show me the diff.
```

## 5. Connect EODHD to your agent (unit 1)

In Claude Code, install the plugin if you want its skills, then type **/mcp**, pick `eodhd` and sign in, as above. In Codex, add the server and sign in as above, start `codex` in the starter, and type **/mcp** to see the server listed. Then paste:

```
Before you call any EODHD tool, tell me which one and how many API
calls it will cost, and ask before anything over 5. First question:
what plan am I on, and how many API calls have I used today?
```

When it has answered, ask one data question:

```
How did AAPL.US close each day from 24 to 28 August 2026? Daily closes only.
```

## 6. The loop — plan, prompt, diff, read, verify, commit (unit 2)

Run one full turn of the loop on the smallest thing you can find in the starter: change the page heading. Overkill on purpose, because you are practising the motion rather than the change. Write the one-line plan first: what the heading should say, and why. Mock mode on, manual mode, and paste, with your heading in place of the brackets:

```
Plan: the page heading should say what this tool is for. In
src/app/page.tsx, change the h1 text to "[your heading]" and nothing
else, except that if a comment beside it describes the old heading,
update the comment so it is true. The page stays a server component; if this needs client code,
stop and tell me why before writing anything. Show me the diff before
it lands. Then explain what the page would show if the heading were an
empty string. Spend no API calls. Afterwards run npm test and
npm run lint, show me the line of the npm test output that starts with
"Tests", and tell me whether npm run lint printed any error. If it did,
show me the fix before making it, then run npm run lint again.
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

Compare its list with the problems in this lesson, then paste:

```
Save your review as notes/review-watchlist.md. Under it, in a section
called "Missed", add the problems from my list below that your review
did not name, one line each. Change no other file and show me the diff.

My list: [the problems you found, one per line]
```

## 8. Your tickers, in one request (unit 2)

Mock mode on. Pick the instruments you actually check, including at least one that is not US-listed. (Why the fixture matters: in mock mode a ticker that has no row in `fixtures/real-time.json` is answered the way the API answers an unknown symbol, with every field `"NA"`, and the starter's shape check drops that row, so the ticker silently never appears. "Done means the tests are green", two lessons on, makes such rows visible; until then a missing fixture row means a missing ticker.) Paste:

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
pass. If changing what quotes() returns breaks an existing test, update
that test too and tell me which one. Run npm test, npm run typecheck
and npm run check:leak.
```

## 10. Done means the tests are green (unit 2)

Create `tests/rows.test.ts` with the test above and run `npm test`. Watch it fail. Stage it with `git add tests/rows.test.ts`, so git holds the version you wrote. Put `EODHD_MOCK=1` in `.env.local` and restart, then give your agent the prompt above in Manual mode, with the plan asked for first:

```
Read tests/rows.test.ts and plan the change before writing code: which
files, and how quotes() will use toRows. Then make the test pass: write
toRows in src/lib/rows.ts and use it in quotes(), so the watchlist shows
an unavailable row instead of dropping it. A row with prices but no
volume, like the test's AAPL row, keeps volume as null and the table
shows a dash. Do not edit tests/rows.test.ts. Other source files and
tests may change where the new row type requires it; list them for me.
Mock mode is on; to see the unavailable row on the page, add a ticker that does not exist (NOTREAL with the US suffix)
to the watchlist for now (mock mode answers "NA" for any symbol it has
no row for). Run npm test and npm run check:leak and show me both
outputs, then the diff.
```

## 11. Sort by what matters to you (unit 3)

Mock mode on, plan mode on, and paste:

```
Add sorting to the watchlist with three orders: my own order from
src/lib/watchlist.ts (the default), size of move (the absolute value
of change_p, biggest first, so -3 comes before +2), and volume, biggest
first. Put it in a pure function sortRows(rows, key, myOrder) in
src/lib/sort.ts, where myOrder is the list of tickers from
src/lib/watchlist.ts, and add a small control that keeps the choice in
localStorage. If the page already has an earlier function that orders
by size of move, replace it with this one and delete it and its test.
Update any comment that still describes the old ordering. The page stays a server component: the control
and the sorted table are one small "use client" island that receives
the rows as props and never fetches. Unavailable rows go last. Plan
first and name the files. Write tests/sort.test.ts before the code: the
input array is not mutated, my order comes from my list rather than
from the response, a -3 move comes before a +2 move, and two rows tied
on size of move come out in the same order whichever order they arrive
in. Show me them failing, then write
the code. No new request. Run npm test and npm run check:leak.
```

## 12. Your own context, next to the numbers (unit 3)

First, in your editor, move "notes on symbols" out of the "Not yet" line in your `PLAN.md`: the plan now includes them, and the agent reads the plan before every change. Then mock mode on, plan mode on, and paste:

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
Add threshold rules as data: a Rule type shaped { ticker, field, op,
value }, where field is "change_p" or "close" and op is ">" or "<",
and fires(rule, quote) in src/lib/rules.ts, and one rule for one of my tickers in
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
If an existing test assumed the newest row decides, change it to the
oldest and tell me which one. Show me the first test failing, then the
code. No request. Run
npm test, npm run typecheck and npm run check:leak.
```

## 16. The wall — where your tool stops being enough (unit 4)

Measure first, with mock mode off and a key of your own in `.env.local` (the `demo` token's counter is shared by everyone, so it cannot be measured; see lesson 4, "First data on screen, and the meter that shows what it cost", for the free key). If you cannot measure today, because you have no key of your own yet or today's calls are spent, estimate instead: the meter's line "Live, it would cost N calls" gives the cost per view, the free plan's limit is 20 a day, and the mock panel from the last lesson gives an age. Put those in the prompt in place of a measurement, and write "estimated" after each figure in `PLAN.md`. Otherwise, open the usage route, the `localhost:3000/api/usage` page on the address `npm run dev` prints (usually `http://localhost:3000`), which costs nothing, and note `used`. Reload the watchlist once, wait a few seconds for the counter to catch up, and open the usage route again. Then paste, with your numbers in place of the brackets:

```
I measured on my own account (or estimated, if I say so): used went
from [before] to [after] for one page view, my daily limit is [limit],
and my data age from the last
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
npm run lint and npm run check:leak and, for each, tell me whether it
passed and quote its summary line.
Then list every environment variable the code reads, and say which one
the host needs, which one must never be set there, and confirm that
none is prefixed NEXT_PUBLIC_. Finally, search src/ for any request
that does not go through eodhdFetch or the proxy route, and show me
what you found.
```
