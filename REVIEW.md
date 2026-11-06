# Review checklist

Run on every diff, and once more on a whole feature before calling it done. The order is
worst consequence first. Review what changed, then whether the whole still makes sense.

## 1. Leaks

Can a secret escape? Can a caller reach something they should not? Does a person's input
reach a request made with my key?

*Screener:* the proxy forwards query parameters. Does it drop `api_token` by name rather
than by luck of line order, rebuild the `filters` from the allowlist, clamp `limit`, and
send back only the fields the table needs, never the upstream body as it came?

## 2. Cost

How many API calls does this make, what does that number grow with (rows, keystrokes,
renders, open tabs), and is the data already in a response I have?

*Screener:* one page view is one `/screener` request, 5 calls. A per-row fetch for a sector
or a profile turns that into 5 + 10 a row; the screener already sends `sector` and
`industry`. No timer: the screen runs on the last completed session.

## 3. Lies

Is any number in units it is not in? Can a missing value render as zero? Are two currencies
in one column?

*Screener:* `dividend_yield` is a fraction (0.0002 is 0.02%). Market cap is unreadable in
full; format it for reading and sort on the raw value. A float like 0.98999999999995 is
rounded at the column. A missing yield is a dash.

## 4. Failure

What does a person see when this breaks: no key, a refused filter, a spent day, no
results? Is a partial result kept or thrown away?

*Screener:* a refused filter names its path ("Filter 1, field"); no key says which file to
fix; a 402 says the day is spent; an empty screen says nothing matched.

## How to write a finding

Name the problem and its consequence, not the keystroke: "This forwards `limit` straight
upstream, so anyone can ask for 500 rows against my key", not "add Math.min".

## Findings, and the test each one became

Unit 3 of Build a Screener, run on the screener as unit 2 left it:

- Leaks: the proxy returned the screener's body as it came. Now it returns the table's
  fields only (`tests/proxy.test.ts`, "returns only the fields the table needs").
- Leaks: with the key removed, the proxy said "Could not reach EODHD", which sends you
  looking at the network. Now it says the key is not set (`tests/proxy.test.ts`).
- Cost: nothing had a number on it. `tests/cost.test.ts` now prices the screen page at 5.
- Lies: market cap was printed in full, 4,551,000,000,000. Now 4.55T, sorted on the raw
  value upstream (`tests/format.test.ts`).
- Lies: the yield conversion lived in a column, untested. Now `asPercent` in
  `src/lib/format.ts`, tested on 0.0002.

## A reader who did not write it

On a branch, with a pull request open, in a fresh session (or another model) that carries
nothing from the one that wrote the change:

```
Review the diff of this branch against main as code you did not write. Use the four
lenses in REVIEW.md: leaks, cost, lies, failure. List each problem with the line it is on
and what it would cost. Do not fix anything.
```

Sort what comes back into real (a line and a consequence you can reproduce: failing test
first, then the fix), plausible and wrong (check, then discard), and taste (ignore unless it
would have prevented a bug). CI on the pull request decides what merges.
