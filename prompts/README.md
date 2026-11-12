# Prompts

The prompts the courses ask you to paste into your coding agent, one file per course. Each
lesson says which prompt to use; the file is here so you can copy it whole instead of
retyping it from a screenshot.

| File | Course |
|---|---|
| [`work-with-an-agent.md`](work-with-an-agent.md) | Pair With Your Agent |
| [`build-your-first-tool.md`](build-your-first-tool.md) | Build Your First Tool |
| [`build-a-screener.md`](build-a-screener.md) | Build a Screener |
| [`backtest-strategies.md`](backtest-strategies.md) | Backtest Strategies |
| [`build-a-dashboard.md`](build-a-dashboard.md) | Build a Dashboard |
| [`ship-your-tool.md`](ship-your-tool.md) | Ship Your Tool |
| [`runs-without-you.md`](runs-without-you.md) | Runs Without You: Schedules and Alerts |

Every file is generated from its lessons' own "The prompt" sections, with the lines around
each prompt that say where and how to paste it, so a prompt here and in its lesson are the
same text. Do not edit them by hand: the next generation overwrites the edit.

They lean on what the repo already gives the agent: the rules in `AGENTS.md`, mock mode, the
cost table in `src/lib/cost.ts`, and `npm test`. Any agent that reads `AGENTS.md` will
follow them.

Paste one prompt at a time. Read what the agent proposes before you say yes, especially
any line that says what a change will cost in API calls.

## Claude Code or Codex CLI

The courses work with both agents. The prompts are the same text for either: both read
`AGENTS.md`, Claude Code through the one-line `CLAUDE.md` that imports it, Codex directly.
Where a lesson's command or file differs between the two, the lines around its prompt give
both, Claude Code first, and a prompt that names one agent's command keeps the lesson's own
wording. The differences you meet most often:

| | Claude Code | Codex CLI |
|---|---|---|
| Start in the learning mode | `claude --permission-mode manual` | `codex --sandbox read-only --ask-for-approval on-request` |
| Plan mode | `Shift+Tab` until plan mode shows, or `/plan`; edits wait until you approve the plan | the same keys, but plan mode is an instruction rather than a lock, so plan in Read Only |
| Fresh context | `/clear` | `/clear`; to make it read `AGENTS.md` again, quit and run `codex` |
| The built-in review | `/code-review` | `/review`, or `codex review --base main` from your shell |
| The EODHD MCP server | `.mcp.json` in this folder; approve it on the first start | `codex mcp add eodhd --url https://mcp.eodhd.com/v2/mcp`, once, from your shell: Codex does not read `.mcp.json` |
| Keeping the agent out of `.env.local` | the deny rules in `.claude/settings.json` | no counterpart; rule 2 of `AGENTS.md` and your own reading of each command |
| Allowing routine commands | `.claude/settings.local.json` | `~/.codex/rules/default.rules`, outside the repository |

Pair With Your Agent explains each row the first time it matters.

## Reference branches

Where a course has reference answers, they are on branches of this repository: one per
lesson for Pair With Your Agent and Runs Without You (`ref/runs-without-you/3`), one per
unit for the five build courses (`ref/build-a-dashboard/u2`). Each branch is what a careful
learner has after that lesson, built on the one before it. If you cloned this starter, it is
already your `origin`: `git fetch origin`, then `git diff origin/ref/<course>/<lesson>`. If your
copy now points at a repository of your own, add the starter once as a second remote,
`git remote add upstream https://github.com/EodHistoricalData/academy-dashboard-starter.git`,
then `git fetch upstream` and `git diff upstream/ref/<course>/<lesson>`.
