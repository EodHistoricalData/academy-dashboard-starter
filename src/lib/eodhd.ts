// Server-only EODHD client. The API key is read from the environment and is NEVER
// sent to the browser. All client data access goes through /api/proxy/* (see
// src/app/api/proxy/[...path]/route.ts), which calls into this module on the server.

import { mockFetch } from "@/lib/mock";

const BASE = process.env.EODHD_API_BASE_URL ?? "https://eodhd.com/api";

function eodhdKey(): string {
  const key = process.env.EODHD_API_KEY;
  if (!key) {
    throw new Error(
      "EODHD_API_KEY is not set. Copy .env.example to .env.local and add your key, or set EODHD_MOCK=1 to work on fixtures.",
    );
  }
  return key;
}

/** Values that are in the key's place but are not a key: empty, and the old placeholder. */
const NOT_A_KEY = new Set(["", "your_key_here"]);

/**
 * What is wrong with the configuration, in one sentence, or null when the app can run: mock
 * mode is on, or the key holds a real value. src/instrumentation.ts throws this sentence as
 * the server starts, so nobody meets a page of empty panels. Takes the environment as a
 * parameter so a test can hand it one.
 */
export function configProblem(env: Record<string, string | undefined>): string | null {
  if (/^(1|true|yes)$/i.test(env.EODHD_MOCK ?? "")) return null;
  if (!NOT_A_KEY.has((env.EODHD_API_KEY ?? "").trim())) return null;
  return (
    "EODHD_API_KEY is not set: copy .env.example to .env.local and add your key, " +
    "or set EODHD_MOCK=1 to run on fixtures."
  );
}

/** Whether a key is set at all. Says nothing about whether the API will accept it. */
export function hasKey(): boolean {
  return Boolean(process.env.EODHD_API_KEY);
}

/**
 * Mock mode: EODHD_MOCK=1 in .env.local. Every request is answered from the JSON files in
 * fixtures/ and nothing goes over the network, so it costs no calls and needs no key.
 *
 * The free plan is 20 calls a day, and the default page costs 5 per load. Debugging a
 * layout by reloading spends the day's quota in four reloads, and then the page stops
 * working for the rest of the day for reasons that have nothing to do with the bug.
 */
export function isMock(): boolean {
  return /^(1|true|yes)$/i.test(process.env.EODHD_MOCK ?? "");
}

/**
 * Fetch an EODHD endpoint on the server. `path` is the API path after `/api`
 * (e.g. "eod/AAPL.US"). The api_token is injected here and must never be passed
 * in by a caller. Defaults to JSON.
 */
export async function eodhdFetch(
  path: string,
  params: Record<string, string> = {},
  opts: { timeoutMs?: number } = {},
): Promise<Response> {
  if (isMock()) return mockFetch(path, params);

  const url = new URL(`${BASE}/${path.replace(/^\/+/, "")}`);
  for (const [k, v] of Object.entries(params)) {
    if (k.toLowerCase() === "api_token") continue; // never honour a caller-supplied token
    url.searchParams.set(k, v);
  }
  if (!url.searchParams.has("fmt")) url.searchParams.set("fmt", "json");
  url.searchParams.set("api_token", eodhdKey());

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), opts.timeoutMs ?? 15_000);
  try {
    return await fetch(url, { signal: controller.signal, cache: "no-store" });
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Remove the key from text on its way back to the browser.
 *
 * An upstream error page can quote the URL it was asked for, token included, and the proxy
 * passes error bodies through because they are the only place that says what went wrong.
 * So the token is cut out of them first: any `api_token=` value, and the key itself
 * wherever it appears. The bare key is matched only when it is long enough to be a key —
 * a short value would be found inside ordinary words and blank real data out of the answer.
 */
export function redactKey(text: string): string {
  let out = text.replace(/(api_token=)[^&\s"'<>]+/gi, "$1[redacted]");
  const key = process.env.EODHD_API_KEY;
  if (key && key.length >= 12) out = out.split(key).join("[redacted]");
  return out;
}

/** Convenience: latest close for a ticker (a single number), or null. */
export async function lastClose(ticker: string): Promise<number | null> {
  try {
    const res = await eodhdFetch(`eod/${ticker}`, { filter: "last_close" });
    if (!res.ok) return null;
    const value = await res.json();
    return typeof value === "number" ? value : null;
  } catch {
    return null;
  }
}
