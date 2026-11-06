import { readFile } from "node:fs/promises";

/**
 * Alert rules, kept as data in alerts/rules.json and checked before anything is fetched.
 *
 * A rule that cannot work should stop the run, not be skipped: a misspelled ticker is still
 * billed by EODHD on every run, and a rule that silently never fires looks exactly like a
 * market that never crossed your line.
 */
export type Op = "crosses_above" | "crosses_below";

export type Rule = {
  id: string;
  /** EODHD's SYMBOL.EXCHANGE, such as AAPL.US. */
  symbol: string;
  op: Op;
  value: number;
};

export const RULES_FILE = "alerts/rules.json";

const OPS: readonly string[] = ["crosses_above", "crosses_below"];

// A ticker, a dot, an exchange code: AAPL.US, VOD.LSE, BTC-USD.CC, EURUSD.FOREX.
const WITH_EXCHANGE = /^[^\s.]+(\.[^\s.]+)*\.[A-Z]+$/;

export class RuleError extends Error {}

/** The rules in `data`, or a RuleError naming the first rule that is wrong. */
export function parseRules(data: unknown): Rule[] {
  if (!Array.isArray(data)) {
    throw new RuleError(`${RULES_FILE} must hold a list of rules.`);
  }
  const seen = new Set<string>();
  return data.map((raw: unknown, i) => {
    const r = (raw ?? {}) as Record<string, unknown>;
    if (typeof r.id !== "string" || r.id.trim() === "") {
      throw new RuleError(`Rule ${i + 1} in ${RULES_FILE} has no id.`);
    }
    const id = r.id;
    if (seen.has(id)) throw new RuleError(`Rule "${id}" is defined twice.`);
    seen.add(id);

    if (typeof r.op !== "string" || !OPS.includes(r.op)) {
      throw new RuleError(
        `Rule "${id}": unknown op ${JSON.stringify(r.op)}. Use crosses_above or crosses_below.`,
      );
    }
    if (typeof r.symbol !== "string" || !WITH_EXCHANGE.test(r.symbol)) {
      throw new RuleError(
        `Rule "${id}": symbol ${JSON.stringify(r.symbol)} has no exchange suffix. Write it as SYMBOL.EXCHANGE, such as AAPL.US.`,
      );
    }
    if (typeof r.value !== "number" || !Number.isFinite(r.value)) {
      throw new RuleError(`Rule "${id}": value must be a number.`);
    }
    return { id, symbol: r.symbol, op: r.op as Op, value: r.value };
  });
}

/** Read and check alerts/rules.json (or another file, for trying a copy). */
export async function readRules(file: string = RULES_FILE): Promise<Rule[]> {
  let data: unknown;
  try {
    data = JSON.parse(await readFile(file, "utf8"));
  } catch (error) {
    const why = error instanceof Error ? error.message : String(error);
    throw new RuleError(`Could not read ${file}: ${why}`);
  }
  return parseRules(data);
}
