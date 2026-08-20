// Server-only EODHD client. The API key is read from the environment and is NEVER
// sent to the browser. All client data access goes through /api/proxy/* (see
// src/app/api/proxy/[...path]/route.ts), which calls into this module on the server.

const BASE = process.env.EODHD_API_BASE_URL ?? "https://eodhd.com/api";

function eodhdKey(): string {
  const key = process.env.EODHD_API_KEY;
  if (!key) {
    throw new Error(
      "EODHD_API_KEY is not set. Copy .env.example to .env.local and add your key.",
    );
  }
  return key;
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
