// End-of-day price alert. Reads alerts/rules.json, says what the run costs, fetches one
// end-of-day series per symbol and prints which rules fired.
//
//   EODHD_MOCK=1 npm run alert     answers from fixtures/, 0 calls
//   npm run alert:local            the same, with the variables in .env.local
//
// Run through tsx: plain Node does not resolve the starter's `@/` import alias.

import { alertMessage, deliver, deliveryChannel } from "@/lib/alerts/deliver";
import { evaluate, type Bar } from "@/lib/alerts/evaluate";
import { readRules, type Rule } from "@/lib/alerts/rules";
import { estimateCalls } from "@/lib/cost";
import { eodhdFetch, isMock, redactKey } from "@/lib/eodhd";

// Enough calendar days for two trading days, across a weekend and a holiday or two.
const DAYS_BACK = 10;

async function main(now: Date): Promise<void> {
  // Before any fetch: a rule that cannot work, or a channel missing a variable, stops the
  // run here, naming the rule or the variable.
  const rules = await readRules();
  const channel = deliveryChannel(process.env);
  const symbols = [...new Set(rules.map((r) => r.symbol))];

  const live = symbols.reduce((sum, s) => sum + (estimateCalls(`eod/${s}`) ?? NaN), 0);
  console.log(
    `${symbols.length} symbol${symbols.length === 1 ? "" : "s"}: ${live} calls live, 0 in mock mode` +
      (isMock() ? " (mock mode is on)" : ""),
  );

  const from = new Date(now.getTime() - DAYS_BACK * 86_400_000).toISOString().slice(0, 10);
  const bars = new Map<string, Bar[]>();
  for (const symbol of symbols) {
    const series = await fetchBars(symbol, from, rules);
    bars.set(symbol, series);
    // The bar's date, not the run's: in a log, this is what says which day was judged.
    console.log(`read ${symbol}: ${series.length} bars, newest ${series.at(-1)?.date ?? "none"}`);
  }

  const fired: string[] = [];
  for (const rule of rules) {
    const series = bars.get(rule.symbol) ?? [];
    const last = series.at(-1);
    const where = last ? `close ${last.close} on ${last.date}` : "no bars";
    const line = `${rule.op === "crosses_above" ? "above" : "below"} ${rule.value}`;
    if (last && evaluate(rule, series)) {
      console.log(`FIRED  ${rule.id}  ${rule.symbol} ${where}, crossed ${line}`);
      fired.push(`${rule.symbol} closed at ${last.close} on ${last.date}, ${line} (${rule.id})`);
    } else {
      console.log(`quiet  ${rule.id}  ${rule.symbol} ${where}, threshold ${line}`);
    }
  }

  // One message for the run, or none. The log says channel, status and count: never the
  // URL or a header, which is where the Telegram token and the Resend key travel.
  const message = alertMessage(fired);
  if (message === null) {
    console.log(`nothing to send: no rule fired (${channel.kind})`);
    return;
  }
  const status = await deliver(channel, message);
  console.log(`delivered: ${channel.kind}, 1 message${status === null ? "" : ` (HTTP ${status})`}`);
}

/** One request per symbol, oldest bar first. A failed request names the rules it serves. */
async function fetchBars(symbol: string, from: string, rules: Rule[]): Promise<Bar[]> {
  const res = await eodhdFetch(`eod/${symbol}`, { from });
  if (!res.ok) {
    const ids = rules.filter((r) => r.symbol === symbol).map((r) => r.id);
    throw new Error(
      `eod/${symbol} answered ${res.status}, for rule ${ids.join(", ")}.` +
        (res.status === 404 ? " Check the ticker: live, a 404 is still billed." : ""),
    );
  }
  const body: unknown = await res.json();
  if (!Array.isArray(body)) return [];
  return body
    .filter(
      (b): b is Bar => typeof b?.date === "string" && typeof b?.close === "number",
    )
    .map((b) => ({ date: b.date, close: b.close }))
    .sort((a, b) => a.date.localeCompare(b.date));
}

// The clock is read here, once, and passed down.
main(new Date()).catch((error: unknown) => {
  console.error(redactKey(error instanceof Error ? error.message : String(error)));
  process.exitCode = 1;
});
