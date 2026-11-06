import { estimateCalls } from "@/lib/cost";
import { eodhdFetch, hasKey, isMock } from "@/lib/eodhd";
import { type Failure, failureFromStatus } from "@/lib/failure";

/** One row of a screen, narrowed from what /screener sends. */
export type ScreenRow = {
  code: string;
  name: string;
  /** The session the row is from: the last completed one, never today's live price. */
  last_day_data_date: string;
  adjusted_close: number;
  refund_1d_p: number | null;
  market_capitalization: number;
  earnings_share: number | null;
  /** A FRACTION, not a percentage: 0.0002 is 0.02%. */
  dividend_yield: number | null;
  sector: string | null;
  currency_symbol: string | null;
};

/** A filter exactly as /screener takes it: field, operator, value. */
export type FilterTriple = [string, string, string | number];

export type Screen = {
  filters: FilterTriple[];
  sort: string;
  limit: number;
};

/**
 * My screen: the twenty biggest profitable companies on US exchanges. `earnings_share > 0`
 * is also what keeps funds and indices out of the universe (see PLAN.md), and it drops
 * loss-makers, which the page says.
 */
export const MY_SCREEN: Screen = {
  filters: [
    ["market_capitalization", ">", 10_000_000_000],
    ["earnings_share", ">", 0],
    ["exchange", "=", "us"],
  ],
  sort: "market_capitalization.desc",
  limit: 20,
};

export function screenRequest(screen: Screen): {
  path: string;
  params: Record<string, string>;
} {
  return {
    path: "screener",
    params: {
      filters: JSON.stringify(screen.filters),
      sort: screen.sort,
      limit: String(screen.limit),
    },
  };
}

/** One screen is one request at 5 calls, however many rows come back. */
export function screenCalls(screen: Screen): number {
  const req = screenRequest(screen);
  return estimateCalls(req.path, req.params) ?? 0;
}

export type ScreenResult =
  | { rows: ScreenRow[] }
  /** The API refused the filters and said which part, in its `errors` envelope. */
  | { invalid: string[] }
  | { failure: Failure };

/**
 * Run a screen on the server, through eodhdFetch like every other request.
 *
 * Two things set /screener apart from the rest of the API. Its rows are wrapped in `data`,
 * so mapping the response object finds nothing and throws nothing. And a filter it does
 * not accept comes back as `{"errors":{"filters.0.field":[...]}}`, keyed by the path into
 * the request: that path is the most useful error in the API, so it is kept and shown.
 */
export async function screen(s: Screen): Promise<ScreenResult> {
  if (!isMock() && !hasKey()) return { failure: { kind: "no-key" } };
  const req = screenRequest(s);

  try {
    const res = await eodhdFetch(req.path, req.params);
    if (!res.ok) {
      if ([401, 402, 403, 429].includes(res.status)) {
        return {
          failure: failureFromStatus(res.status, res.headers.get("retry-after")),
        };
      }
      const messages = screenErrors(await res.json().catch(() => null));
      return messages.length > 0
        ? { invalid: messages }
        : { failure: { kind: "unreachable", status: res.status } };
    }
    return { rows: toScreenRows(await res.json()) };
  } catch {
    return { failure: { kind: "unreachable", status: null } };
  }
}

/** The rows under `data`, each narrowed; anything that is not a usable row is dropped. */
export function toScreenRows(body: unknown): ScreenRow[] {
  const data = (body as { data?: unknown } | null)?.data;
  if (!Array.isArray(data)) return [];
  return data.flatMap((item): ScreenRow[] => {
    if (item === null || typeof item !== "object") return [];
    const r = item as Record<string, unknown>;
    if (
      typeof r.code !== "string" ||
      typeof r.name !== "string" ||
      typeof r.last_day_data_date !== "string" ||
      typeof r.adjusted_close !== "number" ||
      typeof r.market_capitalization !== "number"
    ) {
      return [];
    }
    return [
      {
        code: r.code,
        name: r.name,
        last_day_data_date: r.last_day_data_date,
        adjusted_close: r.adjusted_close,
        refund_1d_p: num(r.refund_1d_p),
        market_capitalization: r.market_capitalization,
        earnings_share: num(r.earnings_share),
        dividend_yield: num(r.dividend_yield),
        sector: typeof r.sector === "string" ? r.sector : null,
        currency_symbol:
          typeof r.currency_symbol === "string" ? r.currency_symbol : null,
      },
    ];
  });
}

/**
 * The screener's own error envelope, as sentences a person can act on:
 * `{"errors":{"filters.0.field":["The selected filters.0.field is invalid."]}}` becomes
 * "Filter 1, field: The selected filters.0.field is invalid." A plain `message`, the shape
 * most other endpoints use, is passed through as it is.
 */
export function screenErrors(body: unknown): string[] {
  if (body === null || typeof body !== "object") return [];
  const { errors, message } = body as { errors?: unknown; message?: unknown };
  if (errors !== null && typeof errors === "object") {
    return Object.entries(errors).map(([path, messages]) => {
      const text = Array.isArray(messages) ? messages.join(" ") : String(messages);
      return `${describePath(path)}: ${text}`;
    });
  }
  return typeof message === "string" ? [message] : [];
}

/** "filters.0.field" -> "Filter 1, field". Other paths are shown as they came. */
function describePath(path: string): string {
  const m = /^filters\.(\d+)(?:\.(\w+))?$/.exec(path);
  if (!m) return path;
  return `Filter ${Number(m[1]) + 1}${m[2] ? `, ${m[2]}` : ""}`;
}

function num(v: unknown): number | null {
  return typeof v === "number" && Number.isFinite(v) ? v : null;
}

/** The session a screen's rows are from: the latest date among them. */
export function screenAsOf(rows: ScreenRow[]): string | null {
  return rows.reduce<string | null>(
    (latest, r) =>
      latest === null || r.last_day_data_date > latest
        ? r.last_day_data_date
        : latest,
    null,
  );
}
