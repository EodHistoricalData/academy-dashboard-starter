// What your alert would cost per day, three ways, for the symbols in alerts/rules.json.
// No network and no key: every price comes from estimateCalls() in src/lib/cost.ts.
//
//   npm run alert:cost                         alerts/rules.json
//   npm run alert:cost -- path/to/rules.json   a copy you are trying out

import { readRules } from "@/lib/alerts/rules";
import { estimateCalls } from "@/lib/cost";

export const FREE_PLAN_CALLS_A_DAY = 20;

/** The US session, 09:30 to 16:00 New York: 390 minutes, so 26 checks every 15 minutes. */
const SESSION_MINUTES = 390;
const EVERY_MINUTES = 15;

export type CostRow = { version: string; perDay: number };

/**
 * Calls a day for each version of the alert. A price missing from the cost table comes
 * out as NaN and prints as a gap, never as zero: an unknown cost means "look it up".
 */
export function alertCosts(symbols: string[]): CostRow[] {
  if (symbols.length === 0) return [];
  const checks = Math.floor(SESSION_MINUTES / EVERY_MINUTES);
  const [first, ...rest] = symbols;

  // One eod request per symbol, once, after the close.
  const endOfDay = symbols.reduce((sum, s) => sum + (estimateCalls(`eod/${s}`) ?? NaN), 0);
  // One real-time request for the whole list, billed per symbol, every check.
  const live = checks * (estimateCalls(`real-time/${first}`, { s: rest.join(",") }) ?? NaN);
  // One intraday request per symbol, every check.
  const intraday = checks * symbols.length * (estimateCalls(`intraday/${first}`) ?? NaN);

  return [
    { version: "end of day, once after the close", perDay: endOfDay },
    { version: `live quotes every ${EVERY_MINUTES} minutes`, perDay: live },
    { version: `intraday bars every ${EVERY_MINUTES} minutes`, perDay: intraday },
  ];
}

async function main(file?: string): Promise<void> {
  const rules = await readRules(file);
  const symbols = [...new Set(rules.map((r) => r.symbol))];
  const rows = alertCosts(symbols);
  const width = Math.max(...rows.map((r) => r.version.length));

  console.log(`${symbols.length} distinct symbol${symbols.length === 1 ? "" : "s"}: ${symbols.join(", ")}\n`);
  for (const row of rows) {
    const calls = Number.isNaN(row.perDay) ? "?" : String(row.perDay);
    console.log(`${row.version.padEnd(width)}  ${calls.padStart(5)} calls a day`);
  }
  console.log(`\nFree plan: ${FREE_PLAN_CALLS_A_DAY} calls a day.`);
  for (const row of rows) {
    const verdict = Number.isNaN(row.perDay)
      ? "unknown: a price is missing from src/lib/cost.ts"
      : row.perDay <= FREE_PLAN_CALLS_A_DAY
        ? "fits"
        : `does not fit: ${row.perDay / FREE_PLAN_CALLS_A_DAY} free days every day`;
    console.log(`  ${row.version}: ${verdict}`);
  }
}

// Run only when called as a script, not when the test imports alertCosts.
if (process.argv[1]?.endsWith("alert-cost.ts")) {
  main(process.argv[2]).catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  });
}
