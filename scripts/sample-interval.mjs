#!/usr/bin/env node
// How often does a symbol's quote actually change? Ask and see.
//
//   npm run dev                                   (in another terminal)
//   node scripts/sample-interval.mjs AAPL.US 10   (ten samples, a minute apart)
//
// Asks the running dev server's proxy for one symbol's real-time quote N times, prints the
// timestamp of each answer and the median gap between distinct ones. That gap is the
// fastest refresh worth having: anything faster fetches a number you already have.
//
// Cost: /real-time is billed per symbol, so each sample is 1 call (src/lib/cost.ts). Ten
// samples of two symbols are 20 calls, a whole free day. In mock mode every sample is the
// same fixture and costs nothing; against your key the script stops before the first
// request and asks for --yes.
//
// Options: --every=<seconds> between samples (default 60), --base=<url> of the dev server
// (default http://localhost:3000), --yes to spend calls against a real key.

import { pathToFileURL } from "node:url";

/**
 * The median gap between distinct consecutive timestamps; null with fewer than two. The
 * same rule as medianGap in src/lib/age.ts, which tests/age.test.ts holds this one to: a
 * repeated timestamp is the same trade seen again, not a gap of zero.
 */
export function medianOf(timestamps) {
  const distinct = [...new Set(timestamps)].sort((a, b) => a - b);
  const gaps = distinct
    .slice(1)
    .map((t, i) => t - distinct[i])
    .sort((a, b) => a - b);
  if (gaps.length === 0) return null;
  const mid = Math.floor(gaps.length / 2);
  return gaps.length % 2 === 1 ? gaps[mid] : (gaps[mid - 1] + gaps[mid]) / 2;
}

export function parseArgs(argv) {
  const flags = Object.fromEntries(
    argv.filter((a) => a.startsWith("--")).map((a) => {
      const [k, v] = a.slice(2).split("=");
      return [k, v ?? true];
    }),
  );
  const [symbol, samples = "10"] = argv.filter((a) => !a.startsWith("--"));
  return {
    symbol,
    samples: Number(samples),
    everyMs: Number(flags.every ?? 60) * 1000,
    base: String(flags.base ?? "http://localhost:3000"),
    yes: flags.yes === true,
  };
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (!/^[A-Z0-9.^_-]+$/i.test(args.symbol ?? "") || !(args.samples >= 2)) {
    console.error("usage: node scripts/sample-interval.mjs SYMBOL.EXCHANGE [samples>=2] [--every=60] [--yes]");
    process.exit(2);
  }

  // The usage route costs nothing and says whether answers come from fixtures.
  const usage = await (await fetch(`${args.base}/api/usage`)).json();
  console.log(
    `${args.samples} samples of ${args.symbol}: ${args.samples} calls (1 per sample).` +
      (usage.mock
        ? " Mock mode: fixtures, no calls spent, and every sample is the same."
        : ` Today: ${usage.used} of ${usage.dailyLimit} used.`),
  );
  if (!usage.mock && !args.yes) {
    console.log("Not mock mode. Run again with --yes to spend them.");
    process.exit(1);
  }

  const timestamps = [];
  for (let i = 0; i < args.samples; i++) {
    if (i > 0) await new Promise((r) => setTimeout(r, args.everyMs));
    const res = await fetch(`${args.base}/api/proxy/real-time/${args.symbol}`);
    if (!res.ok) {
      console.error(`sample ${i + 1}: the proxy answered ${res.status}; stopping.`);
      break;
    }
    const { timestamp } = await res.json();
    timestamps.push(timestamp);
    console.log(`${new Date().toISOString()}  sample ${i + 1}  timestamp ${timestamp}  (${new Date(timestamp * 1000).toISOString()})`);
  }

  const gap = medianOf(timestamps);
  console.log(
    gap === null
      ? `No change in ${timestamps.length} samples: the gap is longer than the run, or the market is closed.`
      : `Median gap between changes: ${gap} s.`,
  );
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  await main();
}
