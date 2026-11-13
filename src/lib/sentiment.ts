import { isTicker } from "@/lib/added";

/**
 * News tone per symbol, from /sentiments: what the answer says, and what a panel may say
 * about it. Pure, so the panel only draws and the tests need no network.
 *
 * Ported from EodHistoricalData/eodhd-news-sentiment, vendor/sentiment.js (MIT, the same
 * holder as this repo), with two changes made on purpose, both said where they happen:
 * fewer than MIN_ARTICLES articles is no reading, and there is no 0–100 score.
 */

/** One day of one symbol: how many articles, and their tone from −1 to 1. */
export type SentimentDay = {
  date: string;
  /** Articles that day. 0 when the answer gave none. */
  count: number;
  /** The day's tone, −1 to 1, or null when the answer gave none. The count still counts. */
  normalized: number | null;
};

export type Trend = "up" | "down" | "flat";

export type Reading = {
  symbol: string;
  /** Null unless status is "ok": too few articles is no reading, not a neutral one. */
  tone: number | null;
  articles: number;
  days: number;
  /** The oldest and newest day the reading rests on, or null with no days. */
  from: string | null;
  to: string | null;
  /** "flat" when there is no reading; status says why, and the panel shows none. */
  trend: Trend;
  status: "ok" | "too-few" | "none";
};

/**
 * Below this many articles a symbol has no reading: a handful of articles is a few writers'
 * mood, not the news. Twenty is a choice made here, and a test holds it.
 */
export const MIN_ARTICLES = 20;

const DATE = /^\d{4}-\d{2}-\d{2}$/;

/**
 * The answer, by symbol, each symbol's days newest first. It comes in two shapes: an object
 * keyed by symbol, and `[]`, an empty array rather than `{}`, when none of the symbols asked
 * for has anything (a symbol with nothing is simply left out of the object). Both read the
 * same here, so nothing downstream has to remember the difference.
 *
 * A key that is not shaped like a ticker is ignored, and so is a day without a date. A day
 * whose tone is not a number is kept: it still has its articles.
 */
export function parseSentiments(body: unknown): Record<string, SentimentDay[]> {
  const out: Record<string, SentimentDay[]> = {};
  if (body === null || typeof body !== "object" || Array.isArray(body)) return out;
  for (const [symbol, list] of Object.entries(body)) {
    if (!isTicker(symbol) || !Array.isArray(list)) continue;
    const days = list.flatMap((item): SentimentDay[] => {
      const d = item as Record<string, unknown> | null;
      if (typeof d?.date !== "string" || !DATE.test(d.date)) return [];
      const count = Math.max(0, finite(d.count) ?? 0);
      return [{ date: d.date, count, normalized: finite(d.normalized) }];
    });
    // Newest first, as the API sends them: trend() reads the first half as the recent one.
    if (days.length > 0) out[symbol] = days.sort((a, b) => b.date.localeCompare(a.date));
  }
  return out;
}

/**
 * The tone of a run of days: their `normalized`, each weighted by its article count, so a
 * day with two articles does not have the say of a day with two hundred. A count below 1
 * weighs 1; a day without a tone is skipped; null when no day is left.
 *
 * Ported from EodHistoricalData/eodhd-news-sentiment, vendor/sentiment.js (MIT),
 * weightedNormalized. Unchanged.
 */
export function tone(days: SentimentDay[]): number | null {
  let sum = 0;
  let weight = 0;
  for (const d of days) {
    if (d.normalized === null || !Number.isFinite(d.normalized)) continue;
    const w = Math.max(1, d.count);
    sum += d.normalized * w;
    weight += w;
  }
  return weight > 0 ? sum / weight : null;
}

function finite(v: unknown): number | null {
  return typeof v === "number" && Number.isFinite(v) ? v : null;
}

export function articles(days: SentimentDay[]): number {
  return days.reduce((s, d) => s + d.count, 0);
}

/** How far the two halves may differ and still read as flat. */
const FLAT = 0.05;

/**
 * Whether the tone is rising: the recent half of the days (newest first, split at
 * floor(n/2)) against the older half, with 0.05 either way counted as flat. Fewer than two
 * days, or a half with no tone, is flat.
 *
 * Ported from EodHistoricalData/eodhd-news-sentiment, vendor/sentiment.js (MIT), getTrend.
 * Changed on purpose: the cut-off allows 1e-9 beyond 0.05, so a difference of exactly 0.05
 * is flat however floating point computes it (0.55 − 0.50 is 0.050000000000000044).
 */
export function trend(days: SentimentDay[]): Trend {
  if (days.length < 2) return "flat";
  const mid = Math.floor(days.length / 2);
  const recent = tone(days.slice(0, mid));
  const older = tone(days.slice(mid));
  if (recent === null || older === null) return "flat";
  const diff = recent - older;
  if (diff > FLAT + 1e-9) return "up";
  if (diff < -FLAT - 1e-9) return "down";
  return "flat";
}

const ORDER: Record<Reading["status"], number> = { ok: 0, "too-few": 1, none: 2 };

/**
 * One reading per asked symbol, highest tone first; symbols with too few articles, then
 * symbols with none, go last.
 *
 * Deliberate change: no fear/greed bands and no 0–100 score. Measured on 2026-11-13 across
 * twelve large symbols, article-weighted tone ran from 0.57 to 0.87: news about large
 * companies reads positive, so a fixed band puts them all in one bucket. The tone stays on its own −1 to 1 scale, and the order is the information: how the
 * symbols compare with each other.
 */
export function readings(
  bySymbol: Record<string, SentimentDay[]>,
  symbols: string[],
): Reading[] {
  const all = symbols.map((symbol): Reading => {
    const days = Object.hasOwn(bySymbol, symbol) ? bySymbol[symbol] : [];
    const count = articles(days);
    const t = tone(days);
    let status: Reading["status"] = "ok";
    if (days.length === 0) status = "none";
    else if (count < MIN_ARTICLES) status = "too-few";
    else if (t === null) status = "none"; // articles, but not one with a tone
    return {
      symbol,
      tone: status === "ok" ? t : null,
      articles: count,
      days: days.length,
      from: days.at(-1)?.date ?? null,
      to: days[0]?.date ?? null,
      trend: status === "ok" ? trend(days) : "flat",
      status,
    };
  });
  // A stable sort: symbols of the same status keep the order they were asked in.
  return all.sort(
    (a, b) => ORDER[a.status] - ORDER[b.status] || (b.tone ?? 0) - (a.tone ?? 0),
  );
}
