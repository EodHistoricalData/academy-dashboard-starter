/**
 * Where numbers get turned into text, once each. Every one of these is a place a number
 * can lie on screen without an error anywhere, so each has one home and a test.
 */

/** A missing value is a dash. Printing 0 would invent a fact, and rank on it. */
export function cell(value: string | null | undefined): string {
  return value ?? "—";
}

/**
 * A FRACTION as a percentage: the screener's `dividend_yield` of 0.0002 is 0.02%. Shown
 * raw beside a % sign it would be a hundred times too small. Nothing else converts it.
 */
export function asPercent(fraction: number): string {
  return `${(fraction * 100).toFixed(2)}%`;
}

/** A value already in per cent, with its sign, rounded at two places: 0.98999999999995 is +0.99%. */
export function signedPercent(percent: number): string {
  const sign = percent > 0 ? "+" : percent < 0 ? "−" : "";
  return `${sign}${Math.abs(percent).toFixed(2)}%`;
}

/**
 * A large figure in a unit a person can read: 5049593888768 is 5.05T. For reading only;
 * sorting is done on the raw number (by the screener itself), because as strings "5.05T"
 * comes before "999B".
 */
export function compact(n: number): string {
  const abs = Math.abs(n);
  if (abs >= 1e12) return `${(n / 1e12).toFixed(2)}T`;
  if (abs >= 1e9) return `${(n / 1e9).toFixed(2)}B`;
  if (abs >= 1e6) return `${(n / 1e6).toFixed(2)}M`;
  return n.toLocaleString("en-US");
}

/**
 * The currency a symbol is quoted in, from its exchange, or null when this table does not
 * know it: no unit rather than a guessed one. London quotes in pence (GBX), not pounds; a
 * crypto or FX pair is quoted in its second currency. Without this, 71.40 for VOD.LSE and
 * 668.20 for SPY.US sit in one column looking like the same kind of number.
 */
const EXCHANGE_CURRENCY: Record<string, string> = {
  US: "USD",
  LSE: "GBX",
  XETRA: "EUR",
  KO: "KRW",
};

export function currencyOf(symbol: string): string | null {
  const dot = symbol.lastIndexOf(".");
  const code = symbol.slice(0, dot);
  const exchange = symbol.slice(dot + 1);
  if (exchange === "CC") return code.split("-")[1] ?? null;
  if (exchange === "FOREX") return code.length === 6 ? code.slice(3) : null;
  return EXCHANGE_CURRENCY[exchange] ?? null;
}

