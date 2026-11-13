import { readFile } from "node:fs/promises";
import path from "node:path";

/**
 * Answers EODHD requests from fixtures/ instead of the network. Used when EODHD_MOCK=1;
 * see isMock() in src/lib/eodhd.ts.
 *
 * Where a request looks for its answer:
 *
 *   real-time/AAPL.US?s=MSFT.US   fixtures/real-time.json, the rows for those symbols
 *   eod/AAPL.US                   fixtures/eod/AAPL.US.json
 *   fundamentals/AAPL.US          fixtures/fundamentals/AAPL.US.json
 *   sentiments?s=AAPL.US,MSFT.US  fixtures/sentiments.json, the days for those symbols
 *   user                          fixtures/user.json
 *
 * To mock something new, save a real answer's shape under the same path. A request with no
 * fixture gets a 404 that names the file it looked for, so the fix is in the error.
 */
const FIXTURES = path.join(process.cwd(), "fixtures");

export async function mockFetch(
  apiPath: string,
  params: Record<string, string>,
): Promise<Response> {
  const segments = apiPath.replace(/^\/+/, "").split("/").filter(Boolean);
  const [endpoint, ...rest] = segments;
  if (!endpoint) return missing("(empty path)");

  if (endpoint === "real-time") return realTime(rest[0], params.s);
  if (endpoint === "sentiments") return sentiments(params);

  const relative =
    rest.length > 0
      ? path.join(endpoint, `${rest.join("/")}.json`)
      : `${endpoint}.json`;
  const data = await readFixture(relative);
  if (data === undefined) return missing(relative);

  if (endpoint === "eod" && params.filter === "last_close" && Array.isArray(data)) {
    return json(data.at(-1)?.close ?? null);
  }
  if (endpoint === "fundamentals" && params.filter) {
    return json(pick(data, params.filter));
  }
  return json(data);
}

type Row = Record<string, unknown> & { code?: string };

/**
 * The one endpoint that is answered per symbol, and that keeps the API's own trap: a bare
 * object for one ticker, an array as soon as `s` is present. A symbol with no row in the
 * fixture comes back as EODHD returns one it has never seen traded — every field "NA".
 */
async function realTime(first: string | undefined, s: string | undefined) {
  const rows = (await readFixture("real-time.json")) as Row[] | undefined;
  if (rows === undefined) return missing("real-time.json");

  const symbols = [first, ...(s ?? "").split(",")]
    .map((x) => x?.trim())
    .filter((x): x is string => Boolean(x));
  const answer = symbols.map(
    (code) => rows.find((r) => r.code === code) ?? notTraded(code),
  );
  return json(s !== undefined ? answer : answer[0] ?? null);
}

/**
 * News tone, keyed by symbol, keeping the API's trap: a symbol with no days is left out of
 * the object, and when none of the asked symbols has any the answer is `[]`, an empty
 * array, not `{}`. `from` and `to` narrow the days, as they do upstream.
 */
async function sentiments(params: Record<string, string>) {
  const all = (await readFixture("sentiments.json")) as Record<string, Row[]> | undefined;
  if (all === undefined) return missing("sentiments.json");

  const within = (d: Row) =>
    typeof d.date === "string" &&
    (!params.from || d.date >= params.from) &&
    (!params.to || d.date <= params.to);
  const answer: Record<string, Row[]> = {};
  for (const symbol of (params.s ?? "").split(",").map((x) => x.trim())) {
    const days = Object.hasOwn(all, symbol) ? all[symbol].filter(within) : [];
    if (days.length > 0) answer[symbol] = days;
  }
  return json(Object.keys(answer).length > 0 ? answer : []);
}

function notTraded(code: string): Row {
  const na = "NA";
  return {
    code,
    timestamp: na,
    gmtoffset: 0,
    open: na,
    high: na,
    low: na,
    close: na,
    volume: na,
    previousClose: na,
    change: na,
    change_p: na,
  };
}

/** `General::Name` -> data.General.Name, the way EODHD reads a fundamentals filter. */
function pick(data: unknown, filter: string): unknown {
  let node = data;
  for (const key of filter.split("::")) {
    if (node === null || typeof node !== "object" || !(key in node)) return "NA";
    node = (node as Record<string, unknown>)[key];
  }
  return node;
}

async function readFixture(relative: string): Promise<unknown> {
  const file = path.resolve(FIXTURES, relative);
  // Paths come from the request. One that climbs out of fixtures/ is treated as absent.
  const inside = path.relative(FIXTURES, file);
  if (inside.startsWith("..") || path.isAbsolute(inside)) return undefined;
  try {
    return JSON.parse(await readFile(file, "utf8"));
  } catch {
    return undefined;
  }
}

function json(body: unknown, status = 200): Response {
  return Response.json(body, { status, headers: { "x-eodhd-mock": "1" } });
}

function missing(relative: string): Response {
  return json(
    {
      error: `Mock mode: no fixture at fixtures/${relative.replaceAll("\\", "/")}. Add one, or remove EODHD_MOCK to call the API.`,
    },
    404,
  );
}
