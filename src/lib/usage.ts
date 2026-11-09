import { eodhdFetch } from "@/lib/eodhd";

type Count = { used: number | null; limit: number | null };

/**
 * Today's count and the daily limit, as the account itself reports them, read at most once a
 * minute. The user endpoint costs no calls, and every server instance reads the same count,
 * where a counter kept in memory would be one per instance. Null when it cannot be read.
 * Server-only.
 */
let cached: { at: number; value: Count } | null = null;

export async function todayCount(now = Date.now()): Promise<Count> {
  if (cached && now - cached.at < 60_000) return cached.value;
  let value: Count = { used: null, limit: null };
  try {
    const res = await eodhdFetch("user", {});
    if (res.ok) {
      const u = (await res.json()) as { apiRequests?: unknown; dailyRateLimit?: unknown };
      value = {
        used: typeof u.apiRequests === "number" ? u.apiRequests : null,
        limit: typeof u.dailyRateLimit === "number" ? u.dailyRateLimit : null,
      };
    }
  } catch {
    // Unread is not over: the per-address limit and the API's own 402 still hold.
  }
  cached = { at: now, value };
  return value;
}
