<!-- Generated from the lessons of Ship Your Tool by scripts/sync_starter_prompts.py in the academy repository. Edit the lesson and run the script; an edit here is overwritten. -->

# Ship Your Tool prompts

The prompts the lessons of this course ask you to paste, in lesson order, copied from the lessons themselves with the lines that say where and how to paste them. Start your agent in this folder, with `EODHD_MOCK=1` in `.env.local` unless the lesson says otherwise, paste one prompt at a time, and read the plan before you say yes. Each lesson says what a good answer changes and how to check it yourself.

The reference state at the end of each unit is on the branch `ref/ship-your-tool/u<unit>` of this repository. If you cloned the starter, it is your `origin`: `git fetch origin`, then `git diff origin/ref/ship-your-tool/u1`. If your copy points at a repository of your own, [README.md](README.md) says how to add the starter as `upstream`.

## 1. What "shipped" actually means (unit 1)

Write the audience sentence yourself: it is a decision, and nothing in the code can make it for you. Then put `EODHD_MOCK=1` in `.env.local`, start the agent in your repository, press `Shift+Tab` until plan mode shows under the prompt, and paste:

```
Read this repository as the person named in the first line of PLAN.md,
who has only the repository and cannot ask me anything. List every question they would need answered before they
could clone it, configure it, run it, and tell whether it is working.
Group them under Run it, Read it, and Tell when it is broken, and name
the file where each answer should live. Make no API call and change no
file. After I approve, add the list under the audience sentence as a
"Shipping backlog" section, and change nothing else.
```

## 2. The README nobody has to ask you about (unit 1)

Mock mode on, plan mode on, and paste:

```
Rewrite README.md in this order: what it is and who it is for, from
the first line of PLAN.md; one screenshot at docs/screenshot.png; run
it in five commands, numbered, with no prose between them except on
the configure step, which says what to set in .env.local: the key, or
EODHD_MOCK=1 to run on fixtures; what you need first, an EODHD API
key and where to get one; what it does;
what it does not do; how it works; and the licence, for the code and
separately for the data. The clone command uses this repository's own
URL from git remote -v, never the starter's
(EodHistoricalData/academy-dashboard-starter); if there is no other,
write TODO there. Answer every question in the Shipping backlog
that belongs in a README. Under "What it does not do", list each limit
you can see in the code, one line each, and write TODO wherever a
figure needs measuring: I fill those in. Make no API call. Show me the
outline first and wait for my yes, then show me the diff.
```

## 3. Configuration for someone else's machine (unit 1)

Mock mode on, plan mode on, and paste:

```
Make the app refuse to run unconfigured. In src/lib/eodhd.ts, the one
file that reads the key, export configProblem(env): null when
EODHD_MOCK is on or EODHD_API_KEY holds a real value, and otherwise one
sentence naming EODHD_API_KEY, the file to copy, and mock mode. Empty
and the old placeholder your_key_here are not real values. Call it from
register() in src/instrumentation.ts and throw its sentence; read this
Next.js version's guide in node_modules/next/dist/docs/ first. Remove
the home page's own no-key branch in src/app/page.tsx, which can no
longer be reached. In
.env.example, empty the key line and list every variable the code
reads, with its default. Tests first. You may edit .env.example, the one env file that holds no
secrets; do not open .env.local. Done
means npm test, npm run typecheck, npm run lint and npm run check:leak
green; then show me the diff.
```

## 4. Licence, attribution, and what you may publish (unit 1)

Mock mode on, plan mode on, and paste:

```
Make the repository say what may be done with it. In LICENSE, keep the
existing copyright line and add one under it with this year and my
name, which I will type. Leave NOTICE as it is unless it names a file
that does not exist. In README.md, under Licence, write two sentences:
the code is MIT, see LICENSE; the market data it fetches is not
covered, see NOTICE. Keep any other sentence now under Licence, such
as one about serving other people from a public URL, after those two
rather than dropping it. Put "Powered by EODHD APIs" and "Not investment
advice" in one footer in src/app/layout.tsx so every page carries it,
and remove any page footer that now says the same thing twice. Make no
API call. Done means npm test, npm run typecheck, npm run lint and
npm run check:leak green; then show me the diff.
```

## 5. CI keeps checking when you stop remembering (unit 2)

The starter's workflow already runs the key scan, lint, type check, tests and the leak check, which builds the app. What it lacks is the check only your project needs. Mock mode on, plan mode on, and paste:

```
Add one step at the end of the checks job in
.github/workflows/key-scan.yml, named "Key stays in eodhd.ts". It fails
when any .ts or .tsx file under src other than src/lib/eodhd.ts
contains EODHD_API_KEY, printing each offending line. Keep it the only
command in its step. Run the same command here and show me what it
prints. For each line, tell me whether it reads the key or only names
it in a sentence; a read moves into src/lib/eodhd.ts, a sentence stops
naming the variable, until the command prints nothing. Then run
npm test, npm run typecheck, npm run lint and
npm run check:leak. Do not push and do not open a pull request: I do
that. Then show me the diff.
```

## 6. What you actually installed (unit 2)

Mock mode on, plan mode on, and paste:

```
Count what this repository depends on: the dependencies and
devDependencies declared in package.json, and the packages in
package-lock.json, and show me the command you counted with. Then run
npm audit and npm audit --omit=dev, and for each finding say whether
it ships with the app or is dev-only, and whether npm audit fix
resolves it without a major version. Change nothing yet. After I
decide, run npm audit fix for any fix I approved, then npm audit again,
and treat a finding the second run still lists as not fixed, whatever
the first run said. Write the two counts under How it works in
README.md, add a step running npm audit --omit=dev right after npm ci
in the checks job of .github/workflows/key-scan.yml, and put every
finding still open in REVIEW.md with my reason and a date to look again.
```

## 7. The security pass before anything is public (unit 2)

Mock mode on, plan mode on, and paste:

```
Add two limits to the proxy, as pure functions in src/lib/rate-limit.ts
with tests written first. Per address: at most 30 requests a minute,
the address taken from the x-forwarded-for header, which the proxy
route passes in; past that, 429 with Retry-After and a sentence. Per
day: before any upstream request, read today's count the way the usage
route does, cached for a minute, in its own src/lib/usage.ts so a test
can replace it, and refuse with 402 and a sentence once it reaches 90%
of the daily limit. Tell me what that check costs
in calls before writing it. Then go through the eight-item list in
this message and write REVIEW.md: one line per item, pass or fail,
with the evidence. Done means npm test, npm run typecheck,
npm run lint and npm run check:leak green; show me the diff.
```

## 8. Errors you can see from outside (unit 2)

Mock mode on, plan mode on, and paste:

```
Three changes, tests first wherever there is logic. One: a logEvent
function in src/lib/log.ts that writes one line of JSON per event; use
it in src/lib/proxy.ts for every upstream status of 400 or more, with
the status and the path only, never the URL or the body. Two: a GET
route in src/app/api/health that answers ok, store (a read succeeds and
its file is still where it was opened) and upstream separately,
calls_used and daily_limit, and
503 when anything is down. It may use the user endpoint and nothing
else upstream. Three: a POST route in src/app/api/client-error that
takes a message and a stack, cuts both short, logs them, and is
limited per address like the proxy; call it from
src/components/PanelBoundary.tsx when a panel crashes. Tell me what
one health check costs before writing it. Done means npm test,
npm run typecheck, npm run lint and npm run check:leak green.
```

## 9. Deploy so that rolling back is boring (unit 3)

Mock mode on, plan mode on, and paste:

```
Add a commit field to the health answer: the commit the running build
came from, read from VERCEL_GIT_COMMIT_SHA on Vercel (or my host's
equivalent), cut to seven characters, and "local" when it is not set.
Then write RUNBOOK.md with one section, Rollback: how a deploy happens,
how to return to the previous deployment on this host, how to go
forward again, and how to tell from the health answer which commit is
live. Take the host's steps from its documentation and say which page.
Do not deploy, roll back or change any setting yourself. Leave a Times
line empty for me. Done means npm test, npm run typecheck,
npm run lint and npm run check:leak green; show me the diff.
```

## 10. Knowing it broke before someone tells you (unit 3)

The watch runs on GitHub Actions, somewhere other than your host, and reports to Healthchecks.io, which tells you about a failure and about silence. Plan mode on, and paste:

```
Add .github/workflows/watch.yml, run every fifteen minutes and by
hand, with a five-minute job timeout. It fetches the deployed health
answer from the HEALTH_URL repository variable with a twenty-second
timeout, and passes only when ok is true and calls_used is under 80% of
daily_limit. On a pass, curl WATCH_HEARTBEAT_URL; on anything else,
curl WATCH_HEARTBEAT_URL/fail with a one-line reason as the body.
WATCH_HEARTBEAT_URL comes from secrets; when it is not set, print a
warning and send nothing. Explain why this spends no API calls before
writing it, and do not run it.
```

## 11. Quota in production (unit 3)

Nothing counts calls per kind of request, so the split becomes stopping points on the one shared count: each kind stops at its own share of the day, and the last tenth is left for a refresh you ask for by hand. Mock mode on, plan mode on, and paste:

```
Turn this degradation order into code. In src/lib/quota-policy.ts,
admit(kind, used, limit, cost) for four kinds of request: background
(a panel nobody is looking at) stops at 50% of the daily limit, auto
(a visible panel's timer) at 75%, alert at 90%, and manual (a "refresh
now" the person pressed) at the limit itself. A request goes out only
if the count after it, priced with estimateCalls, stays within its
kind's share. An unknown count admits only manual. Tests first. The
page marks each request with an x-budget header; the proxy treats a
missing or unknown one as background and refuses with 402, a sentence
naming the stage, and the stage in the body, so the page can tell it
from EODHD's own 402 for a spent day and still send a refresh I press.
Reuse the cached count the daily ceiling already reads, and let this
policy replace that ceiling. Done means npm test, npm run typecheck,
npm run lint and npm run check:leak green; show me the diff.
```

## 12. The final review (unit 3)

The reviewer should not be the session that built the last change. Start a new session in your repository, or type **/clear** first, and paste:

```
Review the whole repository against the four lenses in REVIEW.md —
leaks, cost, lies, failure — and a fifth, comprehension: read only
README.md and tell me what would stop you running this tool. Give
every finding a file and a line and a way to see it go wrong, or say
that a lens found nothing. Change no file and make no API call. After
I mark each finding real, taste or wrong, write the five lenses and my
verdicts in REVIEW.md under today's date, and gather every limitation
in PLAN.md and the README into one section of the README.
```

## 13. What breaks while you are not looking (unit 4)

Plan mode on, and paste:

```
Two changes that catch failures needing no commit. One: run the
checks workflow in .github/workflows/key-scan.yml every Monday and by
hand, as well as on pull requests. Its jobs only run for pull requests
that are not drafts; make the condition say plainly that a scheduled or
manual run counts, and give those runs a concurrency group of their own.
Two: Node is pinned in .nvmrc, which CI reads. In engines in
package.json, which the host reads, state the floor the store's
node:sqlite needs, ">=22.13.0", with no upper limit so a newer Node on
my own machine does not warn, and run npm install so the lockfile's
copy agrees. Change nothing else, run
npm test, npm run typecheck, npm run lint and npm run check:leak, and
show me the diff.
```

## 14. The continuity wall (unit 4)

Plan mode on, and paste:

```
Work out what this tool spends in a day if it runs continuously, from
the code and not from memory: every timer or schedule that triggers a
request, the symbols each one asks for, and the price of each request
from estimateCalls() in src/lib/cost.ts. Fill in this table, one line
per source, showing the working: Interactive use, Alerting,
Monitoring, Total, Allowance. Monitoring should come out at zero; if it
does not, name the request that spends. Make no API call and change no
file. After I add the line I measured on the usage meter and my
decision, write the table into the limitations section of README.md.
```

## 15. Showing it to someone (unit 4)

Plan mode on, and paste:

```
Read REVIEW.md, the test names under tests/, and the workflows under
.github/workflows. Draft three sentences for the top of README.md that
describe this tool by its decisions rather than its features: what it
refuses to do and why, each pointing at a file, a test or a CI step a
reader can open. Add one sentence naming a limit, with the number from
the README's limitations section. Offer two versions and change no
file. After I rewrite one in my own words, put mine under the README's
first line.
```
