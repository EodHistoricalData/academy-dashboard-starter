import { estimateCalls } from "@/lib/cost";
import { eodhdFetch, isMock, redactKey } from "@/lib/eodhd";

/**
 * The endpoints the proxy will sign with your key and forward. Everything else is a 404.
 *
 * An allowlist, not a blocklist. A proxy that forwards any path carries your key to any
 * endpoint: `/api/proxy/user` would hand the account's e-mail address and plan to anyone
 * who can reach the page. If your tool needs another endpoint, add it here — and its cost
 * to src/lib/cost.ts in the same commit.
 */
export const ALLOWED_ENDPOINTS: readonly string[] = [
  "eod",
  "real-time",
  "div",
  "splits",
  "fundamentals",
  "screener",
  "news",
  "technical",
  "intraday",
  "search",
  "exchange-symbol-list",
];

/** How long to ask the caller to wait after a 429 that did not say. */
const DEFAULT_RETRY_AFTER = "60";

type Answer = {
  status: number;
  contentType: string | null;
  retryAfter: string | null;
  body: string;
};

// Requests already on their way upstream, by path and query. A second identical request
// arriving before the first has answered waits for that answer instead of spending the
// same calls again: a page that asks twice for one render, or two tabs opened at once.
const inFlight = new Map<string, Promise<Answer>>();

/**
 * Forward one GET to EODHD and answer it.
 *
 * `segments` is the path after /api/proxy/, as the router split it; `query` is the
 * caller's query string, from which any `api_token` is dropped.
 */
export async function proxy(
  segments: string[],
  query: URLSearchParams,
): Promise<Response> {
  const refusal = refuse(segments);
  if (refusal) return refusal;

  const params: Record<string, string> = {};
  for (const [key, value] of query.entries()) {
    if (key.toLowerCase() === "api_token") continue; // caller cannot set the token
    params[key] = value;
  }

  const target = segments.map(encodeURIComponent).join("/");
  const id = `${target}?${new URLSearchParams(Object.entries(params).sort()).toString()}`;

  let pending = inFlight.get(id);
  if (!pending) {
    const mine = fetchOnce(target, params);
    inFlight.set(id, mine);
    const done = () => {
      if (inFlight.get(id) === mine) inFlight.delete(id);
    };
    mine.then(done, done);
    pending = mine;
  }

  let answer: Answer;
  try {
    answer = await pending;
  } catch (error) {
    const message = error instanceof Error ? error.message : "proxy error";
    return Response.json(
      { error: `Could not reach EODHD: ${redactKey(message)}` },
      { status: 502, headers: { "cache-control": "no-store" } },
    );
  }

  const headers: Record<string, string> = {
    "x-content-type-options": "nosniff",
    // An upstream error can be a whole HTML page. It is data for fetch(), never a
    // document to run on this origin.
    "content-security-policy": "default-src 'none'; sandbox",
    "x-eodhd-calls": String(isMock() ? 0 : (estimateCalls(target, params) ?? "unknown")),
  };
  if (isMock()) headers["x-eodhd-mock"] = "1";

  if (answer.status === 429) {
    headers["retry-after"] = answer.retryAfter ?? DEFAULT_RETRY_AFTER;
    headers["cache-control"] = "no-store";
    return Response.json(
      {
        error:
          "EODHD answered 429: this key has used up its API calls for now. " +
          `Wait ${headers["retry-after"]} seconds and try again. ` +
          "If it is the daily limit (20 calls on the free plan), it resets at midnight UTC. " +
          "Set EODHD_MOCK=1 to keep working on fixtures meanwhile, and see /api/usage for today's count.",
      },
      { status: 429, headers },
    );
  }

  headers["content-type"] = answer.contentType ?? "application/json";
  // Short cache on success only, to soften the free-tier daily limit during development.
  // An error is not worth keeping: the next try should actually try.
  headers["cache-control"] =
    answer.status >= 200 && answer.status < 300 ? "public, max-age=60" : "no-store";
  if (answer.retryAfter) headers["retry-after"] = answer.retryAfter;

  // Status and body pass through. The body of a 403 is the only place that says which
  // feed the plan is missing, and rewriting it would throw that sentence away.
  return new Response(answer.body, { status: answer.status, headers });
}

async function fetchOnce(
  target: string,
  params: Record<string, string>,
): Promise<Answer> {
  const upstream = await eodhdFetch(target, params);
  return {
    status: upstream.status,
    contentType: upstream.headers.get("content-type"),
    retryAfter: upstream.headers.get("retry-after"),
    body: redactKey(await upstream.text()),
  };
}

/** A 404 with the reason, or null when the path may go upstream. */
function refuse(segments: string[]): Response | null {
  const [endpoint] = segments;

  // Every segment is checked, not just the first. The router has already decoded them,
  // so `eod/%2e%2e/user` arrives as ["eod", "..", "user"] — and URL resolution would
  // turn that into /api/user upstream if it were forwarded as written.
  const unsafe = segments.some(
    (s) =>
      s === "" ||
      s === "." ||
      s === ".." ||
      /[/\\?#%]/.test(s) ||
      [...s].some((c) => c.charCodeAt(0) < 0x20 || c.charCodeAt(0) === 0x7f),
  );
  if (unsafe) {
    return notFound("That path is not one this proxy forwards.");
  }

  if (!endpoint || !ALLOWED_ENDPOINTS.includes(endpoint)) {
    const asked = endpoint ? `/${endpoint}` : "an empty path";
    const why =
      endpoint === "user"
        ? " Its answer carries your e-mail address, so it is not forwarded: /api/usage reads your plan and today's count on the server instead."
        : " To use another endpoint, add it to ALLOWED_ENDPOINTS in src/lib/proxy.ts and its cost to src/lib/cost.ts.";
    return notFound(
      `The proxy does not forward ${asked}. It forwards: ${ALLOWED_ENDPOINTS.join(", ")}.${why}`,
    );
  }

  return null;
}

function notFound(message: string): Response {
  return Response.json(
    { error: message },
    { status: 404, headers: { "cache-control": "no-store" } },
  );
}
