import type { Quote } from "@/lib/quotes";
import { isAvailable, type Row } from "@/lib/rows";

/**
 * A rule is a document, not an `if`: one evaluator reads all of them, and adding a rule is
 * a row rather than a deploy. Kept as the "rules" document in the store, seeded from RULES.
 *
 * `field` and `op` are closed lists, checked on read: a rule is something a server may
 * evaluate and act on, so it is privileged input. `lastValue` is what makes a crossing
 * expressible ("crossed above 320" is true once, "above 320" every time), and
 * `lastFiredAt` is there from the first version, for the cooldown that stops a flood.
 *
 * The field is still called `ticker`, as in course 1, so the home page needed no change.
 */
export const RULE_FIELDS = ["close", "change_p", "volume"] as const;
export const RULE_OPS = [">", "<", "crosses_above", "crosses_below"] as const;

export type Rule = {
  id: string;
  ticker: string;
  field: (typeof RULE_FIELDS)[number];
  op: (typeof RULE_OPS)[number];
  value: number;
  enabled: boolean;
  lastFiredAt: number | null;
  lastValue: number | null;
  /** Flap control. Minutes after firing before the rule may fire again. */
  cooldownMin: number;
  /** The level on the other side of the threshold the value must pass to re-arm. */
  rearm: number;
  /** False after firing, until the value has been back past `rearm`. */
  armed: boolean;
  /** Whether the condition held on the previous check: firing needs two in a row. */
  heldLastCheck: boolean;
};

/** The seed: the rule from course 1, as a document. */
export const RULES: Rule[] = [
  {
    id: "msft-down-half",
    ticker: "MSFT.US",
    field: "change_p",
    op: "<",
    value: -0.5,
    enabled: true,
    lastFiredAt: null,
    lastValue: null,
    cooldownMin: 60,
    rearm: -0.25, // re-arms once the day's move has come back above −0.25%
    armed: true,
    heldLastCheck: false,
  },
];

/** Rules from a stored document. A rule whose field or operator is not on the lists is dropped, never repaired. */
export function parseRules(raw: unknown): Rule[] {
  if (!Array.isArray(raw)) return [];
  return raw.flatMap((item): Rule[] => {
    const r = item as Partial<Record<keyof Rule, unknown>> | null;
    if (
      !r ||
      typeof r.id !== "string" ||
      typeof r.ticker !== "string" ||
      !(RULE_FIELDS as readonly unknown[]).includes(r.field) ||
      !(RULE_OPS as readonly unknown[]).includes(r.op) ||
      typeof r.value !== "number" ||
      !Number.isFinite(r.value)
    ) {
      return [];
    }
    const num = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? v : null);
    return [
      {
        id: r.id,
        ticker: r.ticker,
        field: r.field as Rule["field"],
        op: r.op as Rule["op"],
        value: r.value,
        enabled: r.enabled !== false,
        lastFiredAt: num(r.lastFiredAt),
        lastValue: num(r.lastValue),
        // A document saved before flap control had none of these: start armed, at the
        // threshold, with an hour's cooldown.
        cooldownMin: num(r.cooldownMin) ?? 60,
        rearm: num(r.rearm) ?? r.value,
        armed: r.armed !== false,
        heldLastCheck: r.heldLastCheck === true,
      },
    ];
  });
}

export type Verdict = {
  fires: boolean;
  nextLastValue: number | null;
  /** The rest of the next state, when the guards are on. */
  armed: boolean;
  heldLastCheck: boolean;
  lastFiredAt: number | null;
  /** `${rule.id}:${observation timestamp}` for a firing, so a run seen twice fires once. */
  key: string | null;
};

/**
 * Pure: a rule and an observation in, a verdict and the next state out. No I/O, no
 * notification, and the time comes in as `at`. Equal is a decision, written down: for ">"
 * a value exactly on the threshold does not fire, and a crossing needs the previous value
 * on the other side.
 *
 * With `guards`, three mechanisms for three problems, checked in this order:
 *   - debounce: the condition must hold on two checks in a row (removes one-tick noise);
 *   - cooldown: not again within `cooldownMin` of the last firing (limits how often);
 *   - hysteresis: after firing, disarmed until the value is back past `rearm` (changes the
 *     condition, which is what actually stops flapping round a threshold).
 * With the guards on, a crossing rule is its level: "crosses above 320" holds while above,
 * and the hysteresis is what makes it fire once per crossing.
 */
export function evaluate(
  rule: Rule,
  quote: Quote,
  opts: { at?: number; guards?: boolean } = {},
): Verdict {
  const now = quote[rule.field];
  const unchanged = {
    armed: rule.armed,
    heldLastCheck: rule.heldLastCheck,
    lastFiredAt: rule.lastFiredAt,
    key: null,
  };
  if (typeof now !== "number") {
    return { fires: false, nextLastValue: rule.lastValue, ...unchanged };
  }
  const at = opts.at ?? 0;

  if (!opts.guards) {
    const before = rule.lastValue;
    const fires =
      rule.op === ">"
        ? now > rule.value
        : rule.op === "<"
          ? now < rule.value
          : rule.op === "crosses_above"
            ? before !== null && before <= rule.value && now > rule.value
            : before !== null && before >= rule.value && now < rule.value; // crosses_below
    return {
      fires,
      nextLastValue: now,
      ...unchanged,
      lastFiredAt: fires ? at : rule.lastFiredAt,
      key: fires ? `${rule.id}:${quote.timestamp}` : null,
    };
  }

  const holds = conditionHolds(rule, now); // the plain comparison
  const confirmed = holds && rule.heldLastCheck; // debounce: two checks in a row
  const cooled =
    rule.lastFiredAt === null || at - rule.lastFiredAt >= rule.cooldownMin * 60_000;
  const fires = rule.armed && confirmed && cooled;
  // Hysteresis: once fired, stay disarmed until the price is back past the re-arm level.
  const armed = fires ? false : rule.armed || pastRearm(rule, now);
  return {
    fires,
    nextLastValue: now,
    armed,
    heldLastCheck: holds,
    lastFiredAt: fires ? at : rule.lastFiredAt,
    key: fires ? `${rule.id}:${quote.timestamp}` : null, // the loop will run twice
  };
}

const isAbove = (rule: Rule) => rule.op === ">" || rule.op === "crosses_above";

function conditionHolds(rule: Rule, now: number): boolean {
  return isAbove(rule) ? now > rule.value : now < rule.value;
}

function pastRearm(rule: Rule, now: number): boolean {
  return isAbove(rule) ? now < rule.rearm : now > rule.rearm;
}

export function fires(rule: Rule, q: Quote): boolean {
  return evaluate(rule, q).fires;
}

/**
 * What fired, in a sentence that names the rule and the number. A row that turns red says
 * nothing you can act on, and colour alone fails a colour-blind reader.
 */
export function alertText(rule: Rule, q: Quote): string {
  const crossing = rule.op === "crosses_above" || rule.op === "crosses_below";
  const above = rule.op === ">" || rule.op === "crosses_above";
  if (rule.field === "change_p") {
    const move = `${q.change_p < 0 ? "down" : "up"} ${num(Math.abs(q.change_p))}%`;
    return `${q.code} ${move} — your rule was ${crossing ? (above ? "crossing above " : "crossing below ") : ""}${signed(rule.value)}%`;
  }
  const side = `${crossing ? "crossing " : ""}${above ? "above" : "below"}`;
  if (rule.field === "volume") {
    return `${q.code} volume ${q.volume === null ? "unknown" : num(q.volume)} — your rule was ${side} ${num(rule.value)}`;
  }
  return `${q.code} at ${q.close.toFixed(2)} — your rule was ${side} ${num(rule.value)}`;
}

/** What a rule watches, in words: what a person reading their own rules a month later needs. */
export function ruleSentence(rule: Rule): string {
  const crossing = rule.op === "crosses_above" || rule.op === "crosses_below";
  const dir = rule.op === ">" || rule.op === "crosses_above" ? "above" : "below";
  const how = crossing ? `crosses ${dir}` : `is ${dir}`;
  const off = rule.enabled ? "" : " (switched off)";
  switch (rule.field) {
    case "close":
      return `Alert when ${rule.ticker} ${crossing ? `crosses ${dir}` : `trades ${dir}`} ${rule.value.toFixed(2)} (checked against the last price, not the session close)${off}`;
    case "change_p":
      return `Alert when ${rule.ticker}’s change since the previous close ${how} ${signed(rule.value)}%${off}`;
    case "volume":
      return `Alert when ${rule.ticker}’s volume today ${how} ${num(rule.value)}${off}`;
  }
}

/** Every enabled rule that fires against this load's rows. A ticker without prices fires nothing. */
export function firedAlerts(
  rules: Rule[],
  rows: Row[],
): { rule: Rule; quote: Quote }[] {
  return rules.flatMap((rule) => {
    if (!rule.enabled) return [];
    const quote = rows.filter(isAvailable).find((r) => r.code === rule.ticker);
    return quote && fires(rule, quote) ? [{ rule, quote }] : [];
  });
}

function num(n: number): string {
  return n.toLocaleString("en-US", { maximumFractionDigits: 2 });
}

function signed(n: number): string {
  return `${n > 0 ? "+" : n < 0 ? "−" : ""}${num(Math.abs(n))}`;
}
