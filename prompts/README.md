# Prompts

The prompts the courses ask you to paste into your coding agent, one file per course. Each
lesson says which prompt to use; the file is here so you can copy it whole instead of
retyping it from a screenshot.

| File | Course |
|---|---|
| [`work-with-an-agent.md`](work-with-an-agent.md) | Pair With Your Agent |
| [`course-1.md`](course-1.md) | Course 1 |
| [`runs-without-you.md`](runs-without-you.md) | Runs Without You: Schedules and Alerts |

They are written for Claude Code, started in this folder, and they lean on what the repo
already gives the agent: the rules in `AGENTS.md`, mock mode, the cost table in
`src/lib/cost.ts`, and `npm test`. Any agent that reads `AGENTS.md` will follow them.

Paste one prompt at a time. Read what the agent proposes before you say yes, especially
any line that says what a change will cost in API calls.

Where a course has reference answers, they are on branches of this repository named
`ref/<course>/<lesson>`, such as `ref/runs-without-you/3`. Each branch is what a careful
learner has after that lesson, built on the one before it. Add the starter as a remote once,
`git remote add upstream https://github.com/EodHistoricalData/academy-dashboard-starter.git`,
then `git fetch upstream` and `git diff upstream/ref/<course>/<lesson>`.
