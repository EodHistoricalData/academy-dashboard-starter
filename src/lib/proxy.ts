import { estimateCalls } from "@/lib/cost";
import { configProblem, eodhdFetch, isMock, redactKey } from "@/lib/eodhd";
import { checkScreenerQuery } from "@/lib/filters";
import { allow, overCeiling, retryAfter } from "@/lib/rate-limit";
import { toScreenRows } from "@/lib/screen-query";
import { todayCount } from "@/lib/usage";

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

// Requests per caller in the last minute, for the per-address limit (src/lib/rate-limit.ts).
const hits = new Map<string, number[]>();

/**
 * Forward one GET to EODHD and answer it.
 *
 * `segments` is the path after /api/proxy/, as the router split it; `query` is the
 * caller's query string, from which any `api_token` is dropped. `caller` is the address the
 * route read from x-forwarded-for: on a host that sets that header itself it names the
 * caller; where a client can write it, it is a hint, and the daily ceiling is what holds.
 */
export async function proxy(
  segments: string[],
  query: URLSearchParams,
  caller = "unknown",
): Promise<Response> {
  const now = Date.now();
  if (!allow(hits, caller, now)) {
    const wait = retryAfter(hits, caller, now);
    return Response.json(
      {
        error: `Too many requests from this address: this tool answers at most 30 a minute. Try again in ${wait} seconds.`,
      },
      { status: 429, headers: { "retry-after": String(wait), "cache-control": "no-store" } },
    );
  }

  const refusal = refuse(segments);
  if (refusal) return refusal;

  // Said plainly, before anything is sent: "could not reach EODHD" would send you looking
  // at the network for a variable that is simply not set.
  // The sentence comes from src/lib/eodhd.ts, the one file that knows the key's name.
  const problem = configProblem(process.env);
  if (problem) {
    return Response.json(
      { error: problem, kind: "no-key" },
      { status: 503, headers: { "cache-control": "no-store" } },
    );
  }

  let params: Record<string, string> = {};
  for (const [key, value] of query.entries()) {
    if (key.toLowerCase() === "api_token") continue; // caller cannot set the token
    params[key] = value;
  }

  // The screener is where a person's input reaches a request made with the key. Its query
  // is rebuilt from checked values: fields and operators from a fixed list, limit clamped.
  if (segments[0] === "screener") {
    const checked = checkScreenerQuery(params);
    if ("error" in checked) {
      return Response.json(
        { error: checked.error },
        { status: 400, headers: { "cache-control": "no-store" } },
      );
    }
    params = checked.params;
  }

  // The daily ceiling, before anything goes upstream: past 90% of the day this proxy stops
  // asking, so strangers cannot spend the last of it. Reading the count costs no calls.
  const { used, limit } = await todayCount(now);
  if (overCeiling(used, limit)) {
    return Response.json(
      {
        error: `This tool has stopped asking EODHD for today: ${used} of ${limit} calls are used, and the last tenth is kept back. It resumes at 00:00 UTC.`,
      },
      { status: 402, headers: { "cache-control": "no-store" } },
    );
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

  // EODHD has two limits and answers them differently: 402 when the day's calls are spent
  // (20 on the free plan, reset at midnight GMT), 429 when too many requests arrive in one
  // minute (1,000). Waiting a minute fixes the second and does nothing for the first.
  if (answer.status === 402) {
    headers["cache-control"] = "no-store";
    return Response.json(
      {
        error:
          "EODHD answered 402: this key has spent today's API calls (20 a day on the free plan). " +
          "The count resets at midnight GMT; retrying before then only fails again. " +
          "Set EODHD_MOCK=1 to keep working on fixtures meanwhile, and see /api/usage for today's count.",
      },
      { status: 402, headers },
    );
  }

  if (answer.status === 429) {
    headers["retry-after"] = answer.retryAfter ?? DEFAULT_RETRY_AFTER;
    headers["cache-control"] = "no-store";
    return Response.json(
      {
        error:
          "EODHD answered 429: too many requests in one minute (the limit is 1,000 a minute). " +
          `Wait ${headers["retry-after"]} seconds and try again. ` +
          "Something is probably fetching in a loop: check for a request inside a render or an effect without dependencies.",
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
  const body = redactKey(await upstream.text());
  return {
    status: upstream.status,
    contentType: upstream.headers.get("content-type"),
    retryAfter: upstream.headers.get("retry-after"),
    body: upstream.ok ? answerFor(target, body) : body,
  };
}

/**
 * What a successful answer is passed back as. For the screener, only the fields the table
 * uses: a proxy that reflects upstream bodies unexamined will one day reflect something
 * private. Error bodies still pass through, because they say what went wrong.
 */
function answerFor(target: string, body: string): string {
  if (target !== "screener") return body;
  try {
    return JSON.stringify({ data: toScreenRows(JSON.parse(body)) });
  } catch {
    return JSON.stringify({ data: [] });
  }
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
