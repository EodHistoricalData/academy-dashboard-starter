# Course 2 prompts: Build a Screener

The prompts the lessons of this course ask you to paste, in lesson order, copied from the
lessons themselves. Start Claude Code in this folder with `EODHD_MOCK=1` in `.env.local`,
paste one prompt at a time, and read the plan before you say yes. Each lesson says what a
good answer changes and how to check it yourself.

The reference state at the end of each unit is on the branch `ref/build-a-screener/u<unit>` of this
repository: `git fetch upstream`, then `git diff upstream/ref/build-a-screener/u1`.

## 1. What you are building, and why not from zero (unit 1)

Put `EODHD_MOCK=1` in `.env.local`, so nothing here can spend a call. Start the agent in the repository, press `Shift+Tab` until the status bar says plan mode on, and paste:

```
I am turning this watchlist into a watchlist plus a screener, as a
rebuild, not a new project. List every file under src/ and tests/ and
put each under one of four headings: Survives (market-tool code the
screener needs unchanged), Generalises (one thing with a wider
contract), New (does not exist yet: universe, filters, ranking, saved
screens), Dies (makes no sense against results that change on every
run). One line of reason per file. Put a file you cannot place under
Unsure and say why. Make no API call. After I approve, write it as a
"Rebuild" section at the end of PLAN.md and change nothing else.
```

## 2. Read the universe, and find out what is in it (unit 1)

This needs live data once: a fixture would only count itself. Put your free key in `.env.local`, remove the `EODHD_MOCK` line, run `npm run dev` in one terminal and the agent in another, and paste:

```
I want to know what the US symbol list is made of. Before you fetch
anything, tell me the request you will make and its price from
estimateCalls() in src/lib/cost.ts, and wait for my yes. Then fetch
exchange-symbol-list/US once, through the dev server's proxy at
localhost:3000/api/proxy/, count the rows by Type without saving the
response in the repository, and print the counts largest first with
the total. Change no code. Add a "Universe" section to PLAN.md with
the date, the table, and a line "In my universe:" for me to finish.
```

## 3. Your first screen, through the proxy (unit 1)

Mock mode on, plan mode on, and paste:

```
Add a screener page at src/app/screen/page.tsx, rendered on the server
like the watchlist, and put the request in a new src/lib/screens.ts:
one eodhdFetch("screener", ...) with two filters, a sort and limit 10.
The rows arrive under a data key. Show last_day_data_date above the
table. If the answer is an errors object, show each path and message
instead of a table. For mock mode, add fixtures/screener.json in the
shape this lesson shows, with invented numbers. Before writing the
fetch, tell me what one live load of the page costs, from
estimateCalls(). Done means npm test, npm run typecheck, npm run lint
and npm run check:leak green; then show me the diff.
```

## 4. Pull the data layer out of the watchlist (unit 2)

Mock mode on, screenshot taken, plan mode on, and paste:

```
Extract the fetch-check-narrow steps of src/lib/quotes.ts into a new
src/lib/market.ts: call eodhdFetch, check the status before parsing,
narrow the JSON with a guard the caller passes in, and turn a throw
into a failure. On a non-ok answer keep the body if it parses: the
screener's errors are in it. Behaviour unchanged; quotes.ts keeps its
exported signatures and calls market.ts. Change no other file, add no
request. Run npm test before and after, plus typecheck, lint and
check:leak, and show me the diff before committing.
```

## 5. One table, two products (unit 2)

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

## 6. Filters as data, and never trusting the input (unit 2)

Mock mode on, plan mode on, and paste:

```
Add a filter form to the screen page that submits as a GET to the
page itself: f=field:op:value pairs separated by commas, plus limit.
In a new src/lib/filters.ts: the Filter type with a union of allowed
fields, fixed sets of fields and operators, a parser that accepts a
filter or rejects it with a reason naming its position (never
repairs it), and a clamp for limit: default 25, between 1 and 100.
If any filter is rejected, make no request and show the reasons. The
screener request is built only from parsed values. Remove "screener"
from ALLOWED_ENDPOINTS in src/lib/proxy.ts, so this page is the only
way to it. Write tests/filters.test.ts first, for an unknown field,
the operator LIKE and limit=100000 clamped to 100, and show me them
failing. No new request. Done means npm test, typecheck, lint,
check:leak green.
```

## 7. Saved screens — the criteria you keep coming back to (unit 2)

Mock mode on, plan mode on, and paste:

```
Add saved screens. A SavedScreen is { name, filters, sort, createdAt }:
criteria only, never rows. Keep them in localStorage under screens-v1,
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

## 8. A review checklist you can actually run (unit 3)

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

## 9. Reviewing for leaks (unit 3)

Mock mode on, plan mode on, and paste:

```
Check how the screen page builds and answers its screener request
against four leaks: a caller-supplied api_token, an unclamped limit,
an upstream answer passed on whole, and a missing key that becomes a
blank page. For each, say whether our code has it, with the line. Then
write tests/screen-leaks.test.ts in the style of tests/proxy.test.ts:
api_token=fake and limit=99999 in, and assert what would go upstream;
rows keep only the fields our columns use; no key gives a message that
names it. Show me which tests fail, then fix only those. No API call.
Done means npm test, typecheck, lint and check:leak green.
```

## 10. Reviewing for cost (unit 3)

Mock mode on, plan mode on, and paste:

```
Price one view of the screen page in API calls: list every request it
makes, with estimateCalls() for each, and say whether anything refetches
on a timer, per keystroke or once per row. Then add screenPageCalls() to
src/lib/screens.ts, worked out from the same request screen() sends, the
way pageLoadCalls() is for the watchlist, and tests/screen-cost.test.ts
asserting one view costs 5. No live request; I will measure. Done means
npm test, typecheck, lint and check:leak green; show me the diff.
```

## 11. Reviewing for numbers that lie (unit 3)

Mock mode on, plan mode on, and paste:

```
Check every numeric column in src/lib/screen-columns.ts against five
questions: is it a rate, and a fraction or a percentage; where is the
rounding; is it too big to read, and does sorting still use the raw
value; can it be missing, and does missing render as a dash; can two
rows be in different currencies. Answer per column, with the line.
Then fix what fails, with the helpers in a new src/lib/format.ts, one
place per conversion and a comment saying why. Show me one fixture row
before and after. No new request. Done means npm test, typecheck, lint
and check:leak green; show me the diff.
```

## 12. The review that runs itself (unit 3)

Mock mode on, and paste:

```
Write tests/format.test.ts for src/lib/format.ts. Every expected value
is a literal I can check by hand, never computed the way the code
computes it. Then list the defects in notes/review-filters.md and the
last three lessons that no test covers yet, and write one test for
each. Run npm test, then make one expected literal wrong and show me
it red, and put it back. No API call, no change under src/.
```

## 13. A reviewer who did not write it (unit 3)

In the fresh session — **/clear**, or a new terminal — paste:

```
Review the diff of this branch against main as code you did not write.
Use the four lenses in REVIEW.md: leaks, cost, lies, failure. List each
problem with the file, the line and what it would cost. Do not fix
anything. Save the list to notes/review-2.md.
```

## 14. From a list to a shortlist you can defend (unit 4)

Mock mode on, plan mode on, and paste:

```
Add a shortlist to the screen page. A Promote control on each result
row asks for a note, and nothing is saved without one: { code, note,
screen (its f= query), addedAt }. Keep it in localStorage under
shortlist-v1, keyed by code, with the same guarded parse as saved
screens, in src/lib/shortlist.ts, tests first. Show the shortlist with
its notes under the results. Let me pick the sort field from the same
allowlist the filters use, and name it above the results. The heading
says "Matches your filters": no picks, no ticks, no score. No new
request. Done means npm test, typecheck, lint, check:leak green.
```

## 15. The breadth wall (unit 4)

Mock mode off, your key in `.env.local`, the dev server running. Paste:

```
Fill in the breadth section of PLAN.md with measured numbers. Read
today's count from localhost:3000/api/usage, which costs nothing.
Tell me what one screen costs by estimateCalls() and wait for my yes;
I will load the screen page once, and you read the count again a few
seconds later. Ask me how many attempts my last tuning session took,
work out sessions per week from my daily limit, and write the first
three lines with the arithmetic shown. Leave the last two for me.
Change no code.
```

## 16. Ship it beside the watchlist (unit 4)

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
