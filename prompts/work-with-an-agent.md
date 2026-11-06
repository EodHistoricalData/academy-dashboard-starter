# Pair With Your Agent prompts

Start Claude Code with `claude --permission-mode default` while you learn. Paste one prompt
at a time and read every permission prompt before you approve it.

Each lesson's reference answer is on the branch `ref/work-with-an-agent/<lesson>` of this
repository: `git fetch upstream`, then `git diff upstream/ref/work-with-an-agent/4`.

## 1. First table (empty scratch folder, not this repo)

```
Create quotes.mjs, a Node script with no dependencies. It fetches delayed
quotes for AAPL.US, MSFT.US and TSLA.US in ONE request to
https://eodhd.com/api/real-time/AAPL.US?s=MSFT.US,TSLA.US&fmt=json&api_token=demo
and prints a table with four columns: ticker, last price (close), change
on the day in per cent (change_p), and the quote time in UTC from the
timestamp field, which is in Unix seconds. Run it with node and show me
the output. Do not install anything.
```

## 2. Your rules

Write your five rules in a scratch note first, in your words, then:

```
Here are five rules I want to add to AGENTS.md under a new heading
"My rules": [your five rules]. For each one, tell me how you would show
me that you followed it. Rewrite any rule you could not show me, and say
why. Do not edit any file yet.
```

Take the rewrites you agree with, then:

```
Append my rules under "## My rules" at the end of AGENTS.md, and add this
as the last line of that section: "Read PLAN.md before proposing any
change. Anything it does not cover is out of scope: ask before doing it."
Create PLAN.md with five empty headings: Purpose, Data, Not building,
Done means, Riskiest unknown. Then commit both files.
```

## 3. One priced question through the MCP server

Mock mode off and your own key in `.env.local`, which you edit yourself, never the agent.
This one spends one call: read `/api/usage` before and after.

```
Using the eodhd MCP server, get the last five daily closes for AAPL.US.
Before you call anything, tell me which tool you will use and how many
API calls it will cost, and wait for my yes.
```

## 4. Plan mode (Shift+Tab until "plan mode on")

`EODHD_MOCK=1` back in `.env.local`.

```
Add a function sortByMove(rows) in a new file src/lib/move.ts. It takes the
Quote rows from src/lib/quotes.ts and returns them ordered by the size of
the day's move in per cent (change_p), biggest first, up or down. First
write acceptance criteria as short sentences I can check. Then, for each
criterion, the test you will add in tests/move.test.ts. Then the code.
Change no other file.
```

After approving:

```
Write the tests first, with sortByMove as a stub that returns its input
unchanged. Run npm test and show me which tests fail and why. Then write
sortByMove until they pass, and run npm test again.
```

## 5. Close the loop

Mock mode on, and the two allow rules from the lesson in `.claude/settings.local.json`.

```
In src/app/page.tsx, pass the watchlist rows through sortByMove from
src/lib/move.ts before they reach the table, so the biggest move is on
top. Add no request. When you think you are done, run npm test,
npm run typecheck, npm run lint and npm run check:leak, fix whatever they
report, and only then tell me you are done, with the last line of each.
```

## 6. A second reviewer (new session, or /code-review)

```
Review the last two commits against AGENTS.md and PLAN.md. List at most
five findings. For each: the file and line, what goes wrong, and an input
or a sequence of steps that makes it go wrong. Do not change any file.
```

## 7. Hand over before /clear

```
Before I clear this session, add or update a "## Status" section at the
end of PLAN.md: what is done, what is in progress, the next step, and
anything we tried that did not work. Keep it under fifteen lines. Then
stop.
```

After /clear:

```
Read PLAN.md and tell me the next step, in one sentence. Do not start it.
```

## 8. Hand a task off (from your shell, with everything committed)

```bash
claude --bg "Add tests/quotes.test.ts with tests for ageMinutes() in src/lib/quotes.ts: the newest timestamp decides, an empty list gives null, and a timestamp in the future gives 0. Do not change anything under src/. Run npm test, commit on a new branch named test/age-minutes, and stop."
```

When you have read the diff and run the tests yourself, merge it with a merge commit of
your own: `git merge --no-ff test/age-minutes`. A plain `git merge` fast-forwards, because
`main` has not moved, and leaves no merge commit to carry your message.
