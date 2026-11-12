<!-- Generated from the lessons of Build a Screener by scripts/sync_starter_prompts.py in the academy repository. Edit the lesson and run the script; an edit here is overwritten. -->

# Build a Screener prompts

The prompts the lessons of this course ask you to paste, in lesson order, copied from the lessons themselves with the lines that say where and how to paste them. Start your agent in this folder, with `EODHD_MOCK=1` in `.env.local` unless the lesson says otherwise, paste one prompt at a time, and read the plan before you say yes. Each lesson says what a good answer changes and how to check it yourself.

The reference state at the end of each unit is on the branch `ref/build-a-screener/u<unit>` of this repository. If you cloned the starter, it is your `origin`: `git fetch origin`, then `git diff origin/ref/build-a-screener/u1`. If your copy points at a repository of your own, [README.md](README.md) says how to add the starter as `upstream`.

## 1. What you are building, and why not from zero (unit 1)

One thing to know before you start: live screens need a plan that includes EODHD's screener (All-In-One or EOD+Intraday — All World Extended). The free plan covers prices and the symbol list but not the screener, so every screener step in this course has a mock path too, and you can finish the whole course on it.

Put `EODHD_MOCK=1` in `.env.local`, so nothing here can spend a call. Start the agent in the repository, press `Shift+Tab` until plan mode shows under the prompt, and paste:

```
I am turning this watchlist into a watchlist plus a screener, as a
rebuild, not a new project. The watchlist stays; nothing is deleted
from it. List every file under src/ and tests/, plus .githooks/ and the
CI workflow, and put each under one of four headings: Survives
(market-tool code the screener needs unchanged), Generalises (one thing
with a wider contract), New (does not exist yet: name things such as a
universe, filters, ranking, saved screens, not files), Dies (does not
move into the screener because it makes no sense against results that
change on every run; the watchlist keeps it). Each file goes under one
heading only. One line of reason per file. Put a file you cannot place
under Unsure and say why. Make no API call. After I approve, write it
as a "Rebuild" section at the end of PLAN.md and change nothing else.
```

## 2. Read the universe, and find out what is in it (unit 1)

This needs live data once: a fixture would only count itself. It needs your own free key from your EODHD account: the shared `demo` key answers 403 Forbidden on the symbol list, the screener, SPY and delisted tickers. Put your key in `.env.local`, remove the `EODHD_MOCK` line, run `npm run dev` in one terminal and the agent in another, and paste:

```
I want to know what the US symbol list is made of. Before you fetch
anything, tell me the request you will make and its price from
estimateCalls() in src/lib/cost.ts, and wait for my yes. Then fetch
exchange-symbol-list/US once, through the dev server's proxy at
localhost:3000/api/proxy/, count the rows by Type without saving the
response in the repository, and print the counts largest first with
the total. Change no code. Add a "Universe" section to PLAN.md with
the date, the table, and a line "In my universe:" for me to finish.
If the request answers 403 or 402, make no other request and write
the section from these counts instead, saying they are a lesson's
from 2026-08-25 and not mine: FUND 20,884; Common Stock 18,012; ETF
5,801; Mutual Fund 5,154; Preferred Stock 699; Warrant 355; Unit
166; Notes 138; INDEX and a few smaller types 6; total 51,215.
```

## 3. Your first screen, through the proxy (unit 1)

Mock mode on, plan mode on, and paste:

```
Add a screener page at src/app/screen/page.tsx, rendered on the server
like the watchlist, and put the request in a new src/lib/screens.ts:
one eodhdFetch("screener", ...) with two filters (earnings_share > 0
and exchange = us), a sort by market_capitalization descending and
limit 10. The rows arrive under a data key: the answer looks like
{"data":[{"code":"NVDA","name":"NVIDIA Corporation",
"last_day_data_date":"2026-08-24","adjusted_close":208.48,
"refund_1d_p":-2.91,"market_capitalization":5049593888768,
"earnings_share":6.34,"dividend_yield":0.0002,"sector":"Technology",
"industry":"Semiconductors","avgvol_1d":135187288}]}. Show
last_day_data_date above the table. If the answer is an errors object
such as {"errors":{"filters.0.field":["The selected filters.0.field is
invalid."]}}, show each path and message instead of a table. Every
message on this page is about the screen, never advice about the
watchlist's tickers. For mock
mode, add fixtures/screener.json with ten rows of that shape and
invented numbers. Add a test for the part that reads the rows. Before
writing the fetch, tell me what one live load of the page costs, from
estimateCalls(). Done means npm test, npm run typecheck, npm run lint
and npm run check:leak green; then show me the diff.
```

## 5. Pull the data layer out of the watchlist (unit 2)

Mock mode on, screenshot taken, plan mode on, and paste:

```
Extract the fetch-check-narrow steps of src/lib/quotes.ts into one
exported function, marketGet, in a new src/lib/market.ts: call
eodhdFetch, check the status before parsing,
narrow the JSON with a guard the caller passes in, and turn a throw
into a failure. On a non-ok answer keep the body if it parses: the
screener's errors are in it. Behaviour unchanged; quotes.ts keeps its
exported signatures and calls market.ts. Change no other file, add no
request, and add no test in this step. Run npm test before and after, plus typecheck, lint and
check:leak, and show me the diff before committing.
```

## 6. One table, two products (unit 2)

Mock mode on, plan mode on, and paste:

```
Make one table component, src/components/DataTable.tsx, generic over
the row type. It takes rows, a row key and a list of columns
{ key, label, align?, render(row) => string | null }, plus two
optional fields the watchlist needs: tone(row) => "up" | "down" | null
for the change colour, and input(row) for a cell that holds a control,
the note. It renders null as a dash, keeps tabular numerals and
right-aligned figures, shows an empty state with a reason, and
scrolls sideways on a narrow screen.
Render the watchlist and the screen through it, the screen's columns
in src/lib/screen-columns.ts. Build only what these two need: no
sorting, grouping or pinning inside the table. The yield column turns
the API's fraction into a percentage, and nothing else does. No new
request. Done means npm test, typecheck, lint and check:leak green;
show me the diff.
```

## 7. Filters as data, and never trusting the input (unit 2)

Mock mode on, plan mode on, and paste:

```
Add a filter form to the screen page that submits as a GET to the
page itself: f=field:op:value pairs separated by commas, plus limit.
In the address the operators are words, gt lt eq gte lte, for example
f=market_capitalization:gt:1000000000,earnings_share:gt:0.
In a new src/lib/filters.ts: the Filter type with a union of allowed
fields, fixed sets of fields and operators, a parser that accepts a
filter or rejects it with a reason naming its position (never
repairs it), and a clamp for limit: default 25, between 1 and 100.
If any filter is rejected, make no request and show the reasons. The
screener request is built only from parsed values. Remove "screener"
from ALLOWED_ENDPOINTS in src/lib/proxy.ts, so this page is the only
way to it, and make sure the proxy's 404 hint does not invite adding it
back. Write tests/filters.test.ts first, for an unknown field,
the operator LIKE and limit=100000 clamped to 100, and show me them
failing. No new request. Done means npm test, typecheck, lint,
check:leak green.
```

## 8. Saved screens — the criteria you keep coming back to (unit 2)

Mock mode on, plan mode on, and paste:

```
Add saved screens. A SavedScreen is { name, filters: Filter[], sort,
createdAt }: criteria only, never rows. Store the parsed filters, and
build each link back from them as f=field:op:value; there is no sort
control yet, so sort holds the page's default. Keep them in localStorage under screens-v1,
as an object keyed by name, and guard the parse so a broken value
gives an empty list instead of a blank page. Put the storage code in
src/lib/saved-screens.ts as functions that take and return strings,
so tests/saved-screens.test.ts can run without a browser; write those
tests first. Add a small client component that saves the current
screen under a name and lists the saved ones as links to the screen
page with their f= query. The server side does not change. No new
request. Done means npm test, typecheck, lint, check:leak green; show
me the diff.
```

## 9. A review checklist you can actually run (unit 3)

Write `REVIEW.md` yourself: the wording is the part that has to be yours. Then start the agent, plan mode on, and paste:

```
Read REVIEW.md. Review src/lib/filters.ts, the screen page and
tests/filters.test.ts against it, one lens at a time, in its order:
leaks, cost, lies, failure. For each finding give the file, the line,
the lens and what it would cost a user. Spend your attention on the
boundaries: an empty value, a missing field, an error answer, a string
where a number belongs. Do not fix anything and make no API call. After
I approve, save the findings to notes/review-filters.md.
```

## 10. Reviewing for leaks (unit 3)

Mock mode on, plan mode on, and paste:

```
Check how the screen page builds and answers its screener request
against four leaks: a caller-supplied api_token, an unclamped limit,
an upstream answer passed on whole, and a missing key that becomes a
blank page. For each, say whether our code has it, with the line. Then
write tests/screen-leaks.test.ts in the style of tests/proxy.test.ts:
api_token=fake and limit=99999 in, and assert what would go upstream;
rows keep only the fields our columns use; no key gives a message that
names it. If a test renders the page, mock any client component on it
(such as the saved screens list), which needs browser routing. Show me
which tests fail, then fix only those. No API call. Done means npm test,
typecheck, lint and check:leak green.
```

## 11. Reviewing for cost (unit 3)

Mock mode on, plan mode on, and paste:

```
Price one view of the screen page in API calls: list every request it
makes, with estimateCalls() for each, and say whether anything refetches
on a timer, per keystroke or once per row. Then add screenPageCalls() to
src/lib/screens.ts (if a function that prices the screen page already
exists, rename it screenPageCalls and extend it instead of adding a
second one), worked out from the
same request the screen page sends, the way pageLoadCalls() is for the
watchlist, and tests/screen-cost.test.ts asserting one view costs 5. No live request; I will measure. Done means
npm test, typecheck, lint and check:leak green; show me the diff.
```

## 12. Reviewing for numbers that lie (unit 3)

Mock mode on, plan mode on, and paste:

```
Check every numeric column in src/lib/screen-columns.ts against five
questions: is it a rate, and a fraction or a percentage; where is the
rounding; is it too big to read, and does sorting still use the raw
value; can it be missing, and does missing render as a dash; can two
rows be in different currencies. Answer per column, with the line.
Then fix what fails, with the helpers in a new src/lib/format.ts (call
the fraction-to-percentage helper asPercent), one place per conversion
and a comment saying why. Show me one fixture row
before and after. No new request. Done means npm test, typecheck, lint
and check:leak green; show me the diff.
```

## 13. The review that runs itself (unit 3)

Mock mode on, and paste:

```
Write tests/format.test.ts for src/lib/format.ts; if it already exists,
rewrite it so that every expected value is a literal I can check by
hand, never computed the way the code computes it. Then list the
defects in notes/review-filters.md and in the fixes of the last three
commits that no test covers yet, and write one test for each; for a
defect that is found but not fixed, use it.fails. Run npm test, then make one expected literal wrong and show me
it red, and put it back. No API call, no change under src/.
```

## 14. A reviewer who did not write it (unit 3)

The change first. On the new branch (`git switch -c screener-csv-export`), mock mode on, plan mode on, paste:

```
Add a "Download CSV" link to the screen page that downloads the rows
on screen as a CSV file: the same columns, in the same order, from
the rows the page already has, so it makes no new request. Write the
tests first. Done means npm test, typecheck, lint and check:leak
green; then commit on this branch and show me the diff.
```

Push it and open the pull request. Then the review: in the fresh session — **/clear**, or a new terminal — paste:

```
First run git diff main...HEAD --stat and tell me which files differ; if
it is more than this one change, stop and ask me which branch to
compare. Then review the diff of this branch against main as code you
did not write. Use the four lenses in REVIEW.md: leaks, cost, lies,
failure. List each problem with the file, the line and what it would
cost. Do not fix anything. Save the list to notes/review-2.md.
```

## 15. From a list to a shortlist you can defend (unit 4)

Mock mode on, plan mode on, and paste:

```
Add a shortlist to the screen page. A Promote control on each result
row asks for a note, and nothing is saved without one (the page says
a note is needed): { code, note,
screen (its f= query), addedAt }. Keep it in localStorage under
shortlist-v1, keyed by code, with the same guarded parse as saved
screens, in src/lib/shortlist.ts, tests first. Show the shortlist with
its notes under the results. Let me pick the sort field from the same
allowlist the filters use, limited to fields the table shows as a column,
and name it above the results. The sort goes into the one screener
request the page already makes, so a load costs the same. The heading
says "Matches your filters": no picks, no ticks, no score. No new
request. Done means npm test, typecheck, lint, check:leak green.
```

## 16. The breadth wall (unit 4)

Mock mode off, your key in `.env.local`, the dev server running. Paste:

```
Add a "Breadth" section to PLAN.md with these five lines: Cost per
screen attempt, Attempts in a real session, Sessions my allowance buys
per week, Instruments I can see (of how many), What I cannot screen.
Fill in measured numbers. Read today's count from
localhost:3000/api/usage (the field is used; ignore pageLoadCalls, it
prices the watchlist), which costs nothing.
Tell me what one screen costs by estimateCalls() and wait for my yes;
I will load the screen page once, and you read the count again a few
seconds later. Ask me how many attempts my last tuning session took,
work out sessions per week from the dailyLimit in the same answer,
and write the first three lines with the arithmetic shown. If that
limit is in the millions it is the shared demo key's, and if it is 20 it
is the free plan's, which has no screener: in either case use 20 calls
a day and say so. The last lines are mine to write.
Change no code.
```

## 17. Ship it beside the watchlist (unit 4)

Mock mode on, plan mode on, and paste:

```
Add a link each way between the watchlist and the screen page. Then
plan, before any code, an "Add to watchlist" button on each screen
result. The watchlist is a constant in src/lib/watchlist.ts that a
browser cannot write, so propose: where an added symbol is stored, how
the server-rendered watchlist reads it, how it is validated (it comes
from a browser), how a screener code becomes a watchlist symbol, and
what each addition does to the cost of one load. Wait for my approval.
Then build it, tests first. Done means npm test, typecheck, lint and
check:leak green; show me the diff.
```

The storage decision arriving late is the point of the plan. A good one names a store the server can read, validates every symbol it finds there, caps how many, and prices each added real-time symbol at one more call per load.

When the button works, the feature pass, in a fresh session, plan mode on:

```
Read REVIEW.md. Review the whole screener against it, lens by lens in
its order: the screen page and every file under src/ it uses, the
watchlist's new store for added symbols, and their tests. For each
finding give the file, the line, the lens and what it would cost a
user. Fix nothing and make no API call. After I approve, save the
list to notes/review-feature.md.
```
