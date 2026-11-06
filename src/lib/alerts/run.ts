import { createHash } from "node:crypto";
import { alertMessage, type Message } from "@/lib/alerts/deliver";
import { evaluate, type Bar } from "@/lib/alerts/evaluate";
import { FetchError } from "@/lib/alerts/retry";
import type { Rule } from "@/lib/alerts/rules";
import {
  firingKey,
  markPending,
  markSent,
  parseKey,
  pendingKeys,
  type State,
} from "@/lib/alerts/state";

export type RunDeps = {
  rules: Rule[];
  state: State;
  /** Today's New York date, YYYY-MM-DD, from the clock the script read once. */
  today: string;
  save: (state: State) => Promise<void>;
  /** One request for a symbol's recent bars, oldest first. Throws a FetchError on failure. */
  fetchBars: (symbol: string) => Promise<Bar[]>;
  /** Send one message. Throws when it did not go out. */
  send: (message: Message, idempotencyKey: string) => Promise<void>;
  log: (line: string) => void;
};

export type RunResult = {
  /** Symbols a request was made for. Empty means the run spent nothing. */
  fetched: string[];
  /** Keys sent this run: resent ones first, then new firings. */
  sent: string[];
};

/**
 * One run of the alert, made safe to repeat. In order:
 *
 *  1. Resend every key still pending from an earlier run, before anything else.
 *  2. Skip the symbols already judged for today; if none is left, stop: nothing new.
 *  3. Fetch the rest, and judge every bar newer than the last one judged, oldest first,
 *     so a missed Monday is caught up on Tuesday under Monday's key.
 *  4. Mark new firings pending and save, send one message, mark them sent and save.
 *
 * Send, then record: if the job dies between the two, the next run sends again. A rare
 * duplicate is the price of never losing an alert.
 */
export async function runAlerts(deps: RunDeps): Promise<RunResult> {
  const { rules, state, today, save, log } = deps;
  const result: RunResult = { fetched: [], sent: [] };

  // 1. What an earlier run marked pending and could not confirm.
  const pending = pendingKeys(state);
  if (pending.length > 0) {
    const message = alertMessage(pending.map((k) => resentLine(k, rules)))!;
    await deps.send(message, idempotencyKey(pending));
    markSent(state, pending, today);
    await save(state);
    result.sent.push(...pending);
    log(`resent ${pending.length} pending alert${pending.length === 1 ? "" : "s"}`);
  }

  // 2. Nothing to ask for if every symbol was already judged today.
  const symbols = [...new Set(rules.map((r) => r.symbol))];
  const due = symbols.filter((s) => state.symbols[s] !== today);
  if (due.length === 0) {
    log(`nothing new since ${today}: 0 calls`);
    return result;
  }

  // 3. Fetch what is due. One symbol failing does not cost the others their answers; a 402
  // stops the lot, because every further request would meet it too.
  const failures: FetchError[] = [];
  const fired: { key: string; line: string }[] = [];
  for (const symbol of due) {
    let bars: Bar[];
    try {
      bars = await deps.fetchBars(symbol);
    } catch (error) {
      if (!(error instanceof FetchError)) throw error;
      failures.push(error);
      if (error.status === 402) break;
      continue;
    }
    result.fetched.push(symbol);
    const newest = bars.at(-1);
    log(`read ${symbol}: ${bars.length} bars, newest ${newest?.date ?? "none"}`);
    if (!newest) continue;

    // A symbol seen for the first time is judged on its newest bar only, as one run of the
    // first version did; after that, on every bar it has not judged yet.
    const last = state.symbols[symbol];
    const first = last === undefined ? bars.length - 1 : bars.findIndex((b) => b.date > last);
    const symbolRules = rules.filter((r) => r.symbol === symbol);
    const firedHere = new Set<string>();

    for (let i = first === -1 ? bars.length : Math.max(first, 1); i < bars.length; i++) {
      const bar = bars[i];
      for (const rule of symbolRules) {
        const key = firingKey(rule.id, bar.date);
        if (state.keys[key] || !evaluate(rule, bars.slice(0, i + 1))) continue;
        firedHere.add(rule.id);
        log(`FIRED  ${rule.id}  ${symbol} close ${bar.close} on ${bar.date}, crossed ${side(rule)}`);
        fired.push({
          key,
          line: `${symbol} closed at ${bar.close} on ${bar.date}, ${side(rule)} (${rule.id})`,
        });
      }
    }
    for (const rule of symbolRules) {
      if (firedHere.has(rule.id)) continue;
      log(
        `quiet  ${rule.id}  ${symbol} close ${newest.close} on ${newest.date}, threshold ${side(rule)}`,
      );
    }
    state.symbols[symbol] = newest.date;
  }

  // 4. Pending before sending, sent after it, saved both times.
  const keys = fired.map((f) => f.key);
  markPending(state, keys);
  await save(state);
  const message = alertMessage(fired.map((f) => f.line));
  if (message === null) {
    log("nothing to send: no rule fired on a new bar");
  } else {
    await deps.send(message, idempotencyKey(keys));
    markSent(state, keys, today);
    await save(state);
    result.sent.push(...keys);
  }

  if (failures.length > 0) {
    throw new FetchError(failures.map((f) => f.message).join(" "), failures[0].status);
  }
  return result;
}

function side(rule: Rule): string {
  return `${rule.op === "crosses_above" ? "above" : "below"} ${rule.value}`;
}

/** A resent alert has no close to quote: the state file keeps no prices. */
function resentLine(key: string, rules: Rule[]): string {
  const { ruleId, barDate } = parseKey(key);
  const rule = rules.find((r) => r.id === ruleId);
  return rule
    ? `${rule.symbol} crossed ${side(rule)} on ${barDate} (${rule.id}, resent)`
    : `Rule ${ruleId} fired on the bar of ${barDate} (resent; the rule has since been removed)`;
}

/** The message's keys as one Idempotency-Key: the keys themselves, or a hash when too long. */
export function idempotencyKey(keys: string[]): string {
  const joined = [...keys].sort().join(",");
  return joined.length <= 256
    ? joined
    : `alert-${createHash("sha256").update(joined).digest("hex")}`;
}
