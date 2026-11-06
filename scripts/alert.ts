// End-of-day price alert. Reads alerts/rules.json, says what the run costs, fetches one
// end-of-day series per symbol not yet judged today, and sends one message for what fired.
//
//   EODHD_MOCK=1 npm run alert     answers from fixtures/, 0 calls
//   npm run alert:local            the same, with the variables in .env.local
//
// Run through tsx: plain Node does not resolve the starter's `@/` import alias.

import { deliver, deliveryChannel } from "@/lib/alerts/deliver";
import type { Bar } from "@/lib/alerts/evaluate";
import { sleep, withRetry } from "@/lib/alerts/retry";
import { readRules, type Rule } from "@/lib/alerts/rules";
import { runAlerts } from "@/lib/alerts/run";
import { loadState, MOCK_STATE_FILE, saveState, STATE_FILE } from "@/lib/alerts/state";
import { estimateCalls } from "@/lib/cost";
import { eodhdFetch, isMock, redactKey } from "@/lib/eodhd";

// Enough calendar days for two trading days, across a weekend and a holiday or two.
const DAYS_BACK = 10;

const NEW_YORK_DATE = new Intl.DateTimeFormat("en-CA", { timeZone: "America/New_York" });

async function main(now: Date): Promise<void> {
  // Before any fetch: a rule that cannot work, or a channel missing a variable, stops the
  // run here, naming the rule or the variable.
  const rules = await readRules();
  const channel = deliveryChannel(process.env);
  const mock = isMock();
  const stateFile = mock ? MOCK_STATE_FILE : STATE_FILE;
  const state = await loadState(stateFile);

  // The trading day is New York's, not UTC's: at 20:30 there, UTC is already tomorrow.
  const today = NEW_YORK_DATE.format(now);
  const from = new Date(now.getTime() - DAYS_BACK * 86_400_000).toISOString().slice(0, 10);

  const symbols = [...new Set(rules.map((r) => r.symbol))];
  const live = symbols.reduce((sum, s) => sum + (estimateCalls(`eod/${s}`) ?? NaN), 0);
  console.log(
    `${symbols.length} symbol${symbols.length === 1 ? "" : "s"}: ${live} calls live, 0 in mock mode` +
      (mock ? " (mock mode is on)" : ""),
  );

  // Every request is billed, retries included, so the run counts what it sent.
  let requests = 0;
  let spent = 0;
  const result = await runAlerts({
    rules,
    state,
    today,
    save: (s) => saveState(stateFile, s),
    fetchBars: async (symbol) => {
      const res = await withRetry(
        () => {
          requests++;
          spent += mock ? 0 : (estimateCalls(`eod/${symbol}`) ?? NaN);
          return eodhdFetch(`eod/${symbol}`, { from });
        },
        sleep,
        `for rule ${rulesFor(rules, symbol)}`,
      );
      return toBars(await res.json());
    },
    send: async (message, idempotencyKey) => {
      const status = await deliver(channel, message, fetch, { idempotencyKey });
      // Channel, status and count: never the URL or a header, where the secrets travel.
      console.log(
        `delivered: ${channel.kind}, 1 message${status === null ? "" : ` (HTTP ${status})`}`,
      );
    },
    log: (line) => console.log(line),
  });

  if (result.fetched.length > 0) {
    console.log(`spent: ${spent} calls on ${requests} request${requests === 1 ? "" : "s"}`);
  }
}

function rulesFor(rules: Rule[], symbol: string): string {
  return rules
    .filter((r) => r.symbol === symbol)
    .map((r) => r.id)
    .join(", ");
}

/** The bars in an eod answer, oldest first, keeping only the fields the alert reads. */
function toBars(body: unknown): Bar[] {
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
