# Prompts

The prompts the courses ask you to paste into your coding agent, one file per course. Each
lesson says which prompt to use; the file is here so you can copy it whole instead of
retyping it from a screenshot.

| File | Course |
|---|---|
| [`work-with-an-agent.md`](work-with-an-agent.md) | Pair With Your Agent |
| [`course-1.md`](course-1.md) | Course 1: Build Your First Tool |
| [`course-2.md`](course-2.md) | Course 2: Build a Screener |
| [`course-3.md`](course-3.md) | Course 3: Backtest Strategies |
| [`course-4.md`](course-4.md) | Course 4: Build a Dashboard |
| [`course-5.md`](course-5.md) | Course 5: Ship Your Tool |
| [`runs-without-you.md`](runs-without-you.md) | Runs Without You: Schedules and Alerts |

The five course files are generated from the lessons' own "The prompt" sections, so a prompt
here and in its lesson are the same text.

They are written for Claude Code, started in this folder, and they lean on what the repo
already gives the agent: the rules in `AGENTS.md`, mock mode, the cost table in
`src/lib/cost.ts`, and `npm test`. Any agent that reads `AGENTS.md` will follow them.

Paste one prompt at a time. Read what the agent proposes before you say yes, especially
any line that says what a change will cost in API calls.

Where a course has reference answers, they are on branches of this repository: one per
lesson for Runs Without You (`ref/runs-without-you/3`), one per unit for the five build
courses (`ref/build-a-dashboard/u2`). Each branch is what a careful
learner has after that lesson, built on the one before it. If you cloned this starter, it is
already your `origin`: `git fetch origin`, then `git diff origin/ref/<course>/<lesson>`. If your
copy now points at a repository of your own, add the starter once as a second remote,
`git remote add upstream https://github.com/EodHistoricalData/academy-dashboard-starter.git`,
then `git fetch upstream` and `git diff upstream/ref/<course>/<lesson>`.
