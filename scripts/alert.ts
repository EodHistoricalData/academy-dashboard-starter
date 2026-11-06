// End-of-day price alert. Reads alerts/rules.json, says what the run costs, fetches one
// end-of-day series per symbol not yet judged today, and sends one message for what fired.
// Then it decides the outcome: ok, or failed with a one-line reason in alert-outcome.txt
// and a non-zero exit, which is what the workflow's heartbeat reports.
//
//   EODHD_MOCK=1 npm run alert     answers from fixtures/, 0 calls
//   npm run alert:local            the same, with the variables in .env.local
//
// Run through tsx: plain Node does not resolve the starter's `@/` import alias.

import { unlink, writeFile } from "node:fs/promises";
import { tradingDate } from "@/lib/alerts/clock";
import { deliver, deliveryChannel } from "@/lib/alerts/deliver";
import type { Bar } from "@/lib/alerts/evaluate";
import { failureReason, OUTCOME_FILE, staleness, type Outcome } from "@/lib/alerts/outcome";
import { sleep, withRetry } from "@/lib/alerts/retry";
import { readRules, type Rule } from "@/lib/alerts/rules";
import { runAlerts } from "@/lib/alerts/run";
import { loadState, MOCK_STATE_FILE, saveState, STATE_FILE } from "@/lib/alerts/state";
import { estimateCalls } from "@/lib/cost";
import { eodhdFetch, isMock, redactKey } from "@/lib/eodhd";

// Enough calendar days for two trading days, across a weekend and a holiday or two.
const DAYS_BACK = 10;

async function main(now: Date): Promise<void> {
  // Before any fetch: a rule that cannot work, or a channel missing a variable, stops the
  // run here, naming the rule or the variable.
  const rules = await readRules();
  const channel = deliveryChannel(process.env);
  const mock = isMock();
  const stateFile = mock ? MOCK_STATE_FILE : STATE_FILE;
  const state = await loadState(stateFile);

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
    now,
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

  // Every symbol answered; now, is what it answered current?
  const today = tradingDate(now);
  if (today === null) return;
  if (mock) {
    console.log("mock mode: the fixtures' dates are fixed, so freshness is not checked");
    return;
  }
  const stale = staleness(symbols, state.symbols, today);
  if (stale) throw new Error(stale);
}

/** Print the outcome and leave it where the workflow's failure ping can send it. */
async function finish(outcome: Outcome): Promise<void> {
  if (outcome.ok) {
    await unlink(OUTCOME_FILE).catch(() => {});
    console.log("outcome: ok");
    return;
  }
  const reason = redactKey(outcome.reason);
  await writeFile(OUTCOME_FILE, `${reason}\n`);
  console.error(`outcome: failed: ${reason}`);
  process.exitCode = 1;
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
main(new Date()).then(
  () => finish({ ok: true }),
  (error: unknown) => finish({ ok: false, reason: failureReason(error) }),
);
