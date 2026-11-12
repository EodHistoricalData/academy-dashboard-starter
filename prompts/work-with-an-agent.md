<!-- Generated from the lessons of Pair With Your Agent by scripts/sync_starter_prompts.py in the academy repository. Edit the lesson and run the script; an edit here is overwritten. -->

# Pair With Your Agent prompts

The prompts the lessons of this course ask you to paste, in lesson order, copied from the lessons themselves with the lines that say where and how to paste them. Start your agent in its learning mode while you learn, `claude --permission-mode manual` or `codex --sandbox read-only --ask-for-approval on-request`, paste one prompt at a time, and read every permission prompt before you approve it. The first lesson runs in an empty folder, not in this repository; the others run here.

Each lesson's reference answer is on the branch `ref/work-with-an-agent/<lesson>` of this repository. If you cloned the starter, it is your `origin`: `git fetch origin`, then `git diff origin/ref/work-with-an-agent/1`. If your copy points at a repository of your own, [README.md](README.md) says how to add the starter as `upstream`.

## 1. Install your agent, set its limits, and get a first table

Make an empty folder, open a terminal in it, start the agent in its learning mode — `claude --permission-mode manual`, or `codex --sandbox read-only --ask-for-approval on-request` — and paste:

```
Create quotes.mjs, a Node script with no dependencies. It fetches delayed
quotes for AAPL.US, MSFT.US and TSLA.US in ONE request to
https://eodhd.com/api/real-time/AAPL.US?s=MSFT.US,TSLA.US&fmt=json&api_token=demo
and prints a table with four columns: ticker, last price (close), change
on the day in per cent (change_p), and the quote time in UTC from the
timestamp field, which is in Unix seconds. Run it with node and show me
the output. Do not install anything.
```

## 2. Write the rules your agent reads every session

In the starter folder, write your five rules in a scratch note first, in your words. Then start the agent and paste this, with your rules in place of the brackets:

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
Create `PLAN.md` with five headings: Purpose, Data, Not building,
Done means, Riskiest unknown. Under Purpose put one line: "Practise
working with an agent on this watchlist: ordering it by size of move,
tests, reviews." Leave the other four empty. Then commit both files
with the message "AGENTS.md: my five rules, and the pointer to PLAN.md".
```

## 3. MCP while you build, the API while it runs, one budget for both

Put your free key in `.env.local` as described above, turn mock mode off (no `EODHD_MOCK=1` line), run `npm run dev` in one terminal and the agent in another. Use the address `npm run dev` prints on its `Local:` line (usually `http://localhost:3000`; if that port is busy it picks 3001, and the `curl` below must use the same one). Read the counter first. On Windows PowerShell write `curl.exe` where the lessons say `curl`, because plain `curl` there is a different command; in Git Bash it works as written.

```bash
curl -s http://localhost:3000/api/usage
```

It answers with fields like these, with your own numbers:

```json
{ "plan": "free", "used": 3, "dailyLimit": 20, "remaining": 17, "pageLoadCalls": 5, "mock": false }
```

Then paste:

```
Using the eodhd MCP server, get the last five daily closes for AAPL.US.
Before you call anything, tell me which tool you will use and how many
API calls it will cost, and wait for my yes.
```

## 4. Plan mode: from a spec to acceptance criteria to a failing test

Add the line `EODHD_MOCK=1` to `.env.local`, in your editor. Start the agent in the starter folder in its learning mode, press `Shift+Tab` until plan mode shows, and paste:

```
Add a function sortByMove(rows) in a new file src/lib/move.ts. It takes the
Quote rows from src/lib/quotes.ts and returns them ordered by the size of
the day's move in per cent (change_p), biggest first, up or down. First
write acceptance criteria as short sentences I can check. Then, for each
criterion, the test you will add in tests/move.test.ts. Then the code.
Change no other file.
```

Read the plan against the five criteria above. Add what is missing by asking it to keep planning, or with `Ctrl+G` in Claude Code. Approve the way that has you review each edit, then paste:

```
Write the tests first, with sortByMove as a stub that returns its input
unchanged. Run npm test and show me which tests fail and why. Then write
sortByMove until they pass, and run npm test again.
```

## 5. Let the agent close the loop: tests, build, leak check, hooks

Mock mode on. Add the two allow rules above — to `.claude/settings.local.json`, or to Codex's rules file — start the agent in the starter folder, and paste:

```
In src/app/page.tsx, pass the watchlist rows through sortByMove from
src/lib/move.ts before they reach the table, so the biggest move is on
top. Above the table, add one line of plain text that says the order:
"Sorted by size of move, up or down, biggest first." Add no request. If a
comment in the code says the watchlist is deliberately not sorted by
movement, update that comment so it is true.
When you think you are done, run npm test,
npm run typecheck, npm run lint and npm run check:leak, fix whatever they
report, and only then tell me you are done, with the last line of each.
```

## 6. A second reviewer: fresh context, another model, and a sceptical read

With lessons 4 and 5 committed, start a new session in the starter folder and paste:

```
Review the last two commits against AGENTS.md and PLAN.md. List at most
five findings. For each: the file and line, what goes wrong, and an input
or a sequence of steps that makes it go wrong. Do not change any file.
```

## 7. Context hygiene: new sessions, checkpoints and git

In a session that has done some work — the review from the previous lesson is fine — type **/context** in Claude Code, or **/status** in Codex, and look at how full the window is. Then paste:

```
Before I clear this session, add or update a "## Status" section at the
end of PLAN.md: what is done, what is in progress, the next step, and
anything we tried that did not work (write "nothing" if nothing failed).
Keep it under fifteen lines. Then stop.
```

Read the section and correct anything wrong. Commit it yourself (`git add -A`, then `git commit -m "plan: status section, so the next session starts from the file"`), and type **/clear**. Then:

```
Read PLAN.md and tell me the next step, in one sentence. Do not start it.
```

## 8. Hand a task off: background agents and pull requests

Commit everything first: the background session starts from your current state. Run `git status`; if it lists changes you did not make yourself, find out what they are before you commit them. Then, in your shell, not inside a session, hand off the same task with your agent.

With Claude Code, from the starter folder:

```bash
claude --bg "Add tests/quotes.test.ts with tests for ageMinutes() in src/lib/quotes.ts: a single row gives the minutes since its timestamp, an empty list gives null, and a timestamp in the future gives 0. Do not change anything under src/. Run npm test, commit on a new branch named test/age-minutes, and stop."
```

If it answers `Workspace not trusted`, the folder has never been opened in an interactive session: run `claude` there once, accept the question about trusting the folder, quit, and run the command again.

With Codex, make the branch and its worktree yourself, install there — the sandbox will not let the agent reach the network — and start it in a second terminal:

```bash
git worktree add ../starter-age-minutes -b test/age-minutes
cd ../starter-age-minutes
npm install
codex exec --sandbox workspace-write "Add tests/quotes.test.ts with tests for ageMinutes() in src/lib/quotes.ts: a single row gives the minutes since its timestamp, an empty list gives null, and a timestamp in the future gives 0. Do not change anything under src/. Run npm test and stop. Do not commit."
```
