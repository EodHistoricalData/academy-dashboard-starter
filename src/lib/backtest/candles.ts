import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { isMock } from "@/lib/eodhd";
import type { Failure } from "@/lib/failure";
import { marketGet } from "@/lib/market";

/**
 * One daily bar from /eod, oldest first.
 *
 * Two closes, kept apart on purpose: `close` is what printed that day; `adjusted_close` is
 * that price rewritten for every split and dividend since. Returns and signals use
 * adjusted; execution arithmetic (fills, prices paid) uses the raw open, high, low, close.
 */
export type Bar = {
  date: string;
  open: number;
  high: number;
  low: number;
  /** Raw: what printed. For fills. */
  close: number;
  /** Adjusted for splits and dividends since. For returns and signals. */
  adjusted_close: number;
  volume: number;
};

export type CandlesResult =
  | { bars: Bar[]; pulledAt: string; cached: boolean }
  /** /eod answered 404 with its plain-text reason, usually a mistyped ticker. */
  | { notFound: string }
  | { failure: Failure };

/**
 * /eod answers with a bare array (not the screener's `data` envelope). Every row is
 * narrowed, and the order is asserted: a series that arrives newest-first and is used as
 * it came silently reverses time.
 */
export function toBars(body: unknown): Bar[] {
  if (!Array.isArray(body)) return [];
  const bars = body.flatMap((item): Bar[] => {
    const r = item as Record<string, unknown>;
    const nums = ["open", "high", "low", "close", "adjusted_close", "volume"] as const;
    if (typeof r?.date !== "string" || nums.some((k) => typeof r[k] !== "number")) {
      return [];
    }
    return [
      {
        date: r.date,
        open: r.open as number,
        high: r.high as number,
        low: r.low as number,
        close: r.close as number,
        adjusted_close: r.adjusted_close as number,
        volume: r.volume as number,
      },
    ];
  });
  assertOldestFirst(bars);
  return bars;
}

export function assertOldestFirst(bars: Bar[]): void {
  if (bars.length > 1 && bars[0].date > bars[bars.length - 1].date) {
    throw new Error("bars must be oldest-first");
  }
}

const CACHE = path.join(process.cwd(), ".cache", "eod");

/**
 * The daily history of one symbol: one call, whatever the range, so the whole history is
 * pulled once and kept on disk with the date it was pulled. A cache here is a dated
 * snapshot, not the truth: the adjusted column is rewritten after every dividend and split,
 * so delete the file to refresh it deliberately.
 *
 * Mock mode skips the cache; the fixtures are already local and cost nothing. A host with
 * a read-only disk skips the write and pays the call each time.
 */
export async function loadCandles(
  symbol: string,
  range: { from?: string; to?: string } = {},
): Promise<CandlesResult> {
  const file = path.join(
    CACHE,
    `${symbol}_${range.from ?? "start"}_${range.to ?? "end"}.json`,
  );

  if (!isMock()) {
    const cached = await readCache(file);
    if (cached) return { ...cached, cached: true };
  }

  const params: Record<string, string> = {};
  if (range.from) params.from = range.from;
  if (range.to) params.to = range.to;
  const result = await marketGet(`eod/${symbol}`, params, toBars);

  if (!result.ok) {
    if (result.failure.kind === "unreachable" && result.failure.status === 404) {
      const body = result.body as { error?: unknown } | string | null;
      return {
        notFound:
          typeof body === "string"
            ? body
            : typeof body?.error === "string"
              ? body.error // mock mode names the fixture it looked for
              : "Ticker Not Found.",
      };
    }
    return { failure: result.failure };
  }

  const pulledAt = new Date().toISOString();
  if (!isMock()) await writeCache(file, { pulledAt, bars: result.value });
  return { bars: result.value, pulledAt, cached: false };
}

async function readCache(
  file: string,
): Promise<{ bars: Bar[]; pulledAt: string } | null> {
  try {
    const saved = JSON.parse(await readFile(file, "utf8"));
    const bars = toBars(saved.bars);
    return bars.length > 0 && typeof saved.pulledAt === "string"
      ? { bars, pulledAt: saved.pulledAt }
      : null;
  } catch {
    return null;
  }
}

async function writeCache(
  file: string,
  data: { pulledAt: string; bars: Bar[] },
): Promise<void> {
  try {
    await mkdir(path.dirname(file), { recursive: true });
    await writeFile(file, JSON.stringify(data));
  } catch {
    // Read-only disk: the run still works, it just pays for the history again next time.
  }
}
