<!-- Generated from the lessons of Runs Without You: Schedules and Alerts by scripts/sync_starter_prompts.py in the academy repository. Edit the lesson and run the script; an edit here is overwritten. -->

# Runs Without You: Schedules and Alerts prompts

The prompts the lessons of this course ask you to paste, in lesson order, copied from the lessons themselves with the lines that say where and how to paste them. Start your agent in this folder with `EODHD_MOCK=1` in `.env.local`. Every prompt works in mock mode; the live checks in each lesson are yours to run, not the agent's. Paste one prompt at a time and read the plan before you say yes.

Each lesson's reference answer is on the branch `ref/runs-without-you/<lesson>` of this repository. If you cloned the starter, it is your `origin`: `git fetch origin`, then `git diff origin/ref/runs-without-you/1`. If your copy points at a repository of your own, [README.md](README.md) says how to add the starter as `upstream`.

## 1. An alert that fits the free plan

With `EODHD_MOCK=1` in `.env.local`, start your agent in the repository and paste:

```
Read AGENTS.md. Plan an end-of-day price alert that runs as a script, and show me the plan before writing code.
- alerts/rules.json holds rules as data: id, symbol, op (crosses_above or crosses_below), value. src/lib/alerts/rules.ts validates them on read: an unknown op, a symbol without an exchange suffix or a duplicate id stops the run before any fetch, naming the rule.
- src/lib/alerts/evaluate.ts: a pure evaluate(rule, bars) comparing the last two daily closes with the threshold. No fetch, no clock, no printing.
- scripts/alert.ts: read the time once and pass it down; fetch eod/SYMBOL once per distinct symbol through eodhdFetch(), from ten days back; print FIRED or quiet per rule with symbol, close, bar date and threshold. First print the run's live cost from estimateCalls() in src/lib/cost.ts.
- package.json: "alert" runs tsx scripts/alert.ts, "alert:local" runs tsx --env-file=.env.local scripts/alert.ts; tsx as a dev dependency.
- A fixture under fixtures/eod/ for a second symbol whose last two closes cross a rule, so exactly one rule fires in mock mode.
- tests/alert-evaluate.test.ts: crossing up, crossing down, no crossing, a close exactly on the threshold, fewer than two bars.
Mock mode only; run nothing live. Run npm test and show me the diff.
```

## 2. A schedule, not a tab: GitHub Actions and the market close

Plan this one first: press `Shift+Tab` until plan mode shows, or type `/plan` — the same in Claude Code and Codex — and the agent proposes without editing. Paste:

```
Plan first. Add .github/workflows/alert.yml to run our alert job.
- Triggers: schedule at 30 17 * * 1-5 with timezone America/New_York, and workflow_dispatch for manual runs.
- One job on ubuntu-latest, timeout-minutes 10, concurrency group "alert" with cancel-in-progress false.
- Steps: the checkout and setup-node steps from .github/workflows/key-scan.yml, then npm ci, then npm run alert with EODHD_MOCK set to "1" in its env. No secrets yet. Make scripts/alert.ts print the bar date of every symbol it read.
Explain each trigger and the concurrency block in one sentence before writing. Do not touch key-scan.yml.
```

## 3. A message on your phone, and the secrets that send it

```
Add delivery to the alert job. Plan first.
- src/lib/alerts/deliver.ts: deliver(message), chosen by ALERT_DELIVERY: console, the default when ALERT_DELIVERY is not set, so npm run alert and alert:local keep working as they are; telegram (TELEGRAM_BOT_TOKEN, TELEGRAM_CHAT_ID, sendMessage as a JSON POST); email (RESEND_API_KEY, ALERT_EMAIL_TO, from onboarding@resend.dev).
- A channel that was asked for and has a missing variable exits non-zero before any fetch, naming it. Never fall back from it to console.
- One message per run listing every fired rule, nothing when nothing fired, ending "End-of-day data from EODHD APIs". Never log a URL or a header: log channel, status and message count.
- tests/alert-deliver.test.ts: a fake fetch; assert method, URL shape and body for both channels with made-up credentials, and that a missing variable fails.
- Workflow: drop EODHD_MOCK, set ALERT_DELIVERY to telegram, pass EODHD_API_KEY, TELEGRAM_BOT_TOKEN and TELEGRAM_CHAT_ID from secrets into the alert step's env only.
- AGENTS.md: the agent runs the alert job in mock mode only and never calls a delivery API with real credentials.
Do not ask me for a token and do not read .env.local.
```

## 4. Never twice, never zero: retries and dedup in production

```
Make the alert job idempotent. Plan first and list the failure cases you will test.
- alerts/state.json: per symbol, the last processed bar date; per key "<rule id>:<bar date>", status pending or sent and the date sent. No prices. Mock runs read and write alerts/state.mock.json instead, added to .gitignore, so fixture dates never reach the real state.
- One message per run, as before, listing every key not yet sent, pending ones first. Mark all of them pending, send, mark them sent together. For email, the Idempotency-Key header is those keys, sorted and joined.
- Trading date: the New York date on a weekday, none on a weekend. On a weekend, print "no trading day" and exit 0 with no calls. On a weekday, skip symbols whose last processed bar date is already today's trading date; if none is left, print "nothing new since <date>" and exit 0 with no calls. Otherwise fetch the rest, and if no bar is newer than the state's date, print the same line and send nothing. Evaluate every newer bar, oldest first.
- src/lib/alerts/retry.ts, sleep passed in and no clock read: 402 stops non-zero; 429 waits for Retry-After and retries once; 403 and 404 never retry and name the rule; 5xx and timeouts retry twice with a growing pause.
- Workflow: permissions contents: write; a second schedule at 30 20 * * 1-5 in America/New_York; install with npm ci --ignore-scripts, so the repository's git hooks are not switched on for the bot; after the alert step, a step with if: always() that commits alerts/state.json as github-actions[bot] when it changed, and pushes.
- Tests: two runs on the same data send once; a failed send goes out next run; a 402 is not retried; a missed day gets its own key; a Saturday run fetches nothing.
```

## 5. A test with a fake clock, written by your agent

In plan mode (`Shift+Tab` until it is on), paste:

```
Read the cases under "Clock cases" in PLAN.md.
- src/lib/alerts/clock.ts: tradingDate(now: Date): string | null, the New York date on a weekday and null on a weekend, using Intl with time zone America/New_York. Nothing else in src/lib/alerts may call new Date() or Date.now(), retry.ts included: remove any default that reads the clock. The runner uses tradingDate instead of any date logic of its own, and scripts/alert.ts reads the clock once and passes it down.
- tests/alert-clock.test.ts: one test per case, named after it, each setting its own instant. Where code reads Date itself, use vi.setSystemTime and restore with vi.useRealTimers() in afterEach.
- For the retry case, pass a vi.fn() as the sleep and assert the pauses; nothing may actually wait.
- Add no cases I did not write. If one is missing, say so and stop.
Run the new file, then the whole suite.
```

## 6. A heartbeat: knowing when the alert went quiet

```
Add a heartbeat to the alert job. Plan first.
- scripts/alert.ts decides the outcome: ok, or failed with a one-line reason (402, stale data, delivery error, invalid rule). Stale means any symbol's newest bar is more than one weekday behind today's New York trading date. In mock mode, skip the staleness check and print that it was skipped: the fixtures' dates are fixed. On failure, write the reason to alert-outcome.txt, print it, exit non-zero.
- On a Friday trading date, also deliver a digest from alerts/state.json, with no extra fetch: rules, symbols, newest bar date, alerts sent this week. Send it once per Friday: record the digest's trading date in alerts/state.json when it is sent, and send nothing more when that date is already there, so the 20:30 run on the same Friday adds no second digest. A weekend run has no trading date: it checks nothing for staleness and reports ok.
- Workflow, after the state step: on success, curl HEARTBEAT_URL; on failure, curl HEARTBEAT_URL/fail with alert-outcome.txt as the body; a ten-second timeout; HEARTBEAT_URL from secrets. If HEARTBEAT_URL is not set, each step prints a warning and exits 0 without calling curl.
- Tests with fixed instants: one weekday old is fine, two is stale, Friday sends the digest and Thursday does not, and a second Friday run does not send it again.
```

## 7. The wall: intraday alerts are a plan question

```
Add npm run alert:cost (scripts/alert-cost.ts). It takes an optional path to a rules file, default alerts/rules.json; read that file and print, for its distinct symbols, the calls per day of: end of day once after the close; live quotes every 15 minutes through a 6.5-hour session; intraday bars every 15 minutes, one request per symbol.
Price every request with estimateCalls() from src/lib/cost.ts; never hard-code a cost. Under the table, print the free plan's 20 calls a day and mark what fits. No network, no key.
Add a test that three symbols give 3, 78 and 390.
```
