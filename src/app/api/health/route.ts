import { eodhdFetch } from "@/lib/eodhd";
import { storeReadable } from "@/lib/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type UserAnswer = { apiRequests?: unknown; dailyRateLimit?: unknown };

/**
 * Is the tool working, asked from outside. Costs no calls: one read of the store, no write,
 * and upstream only through the free user endpoint. Names the commit that is running, says
 * which half is down, and carries today's count, never the account's e-mail address, which
 * the user endpoint also returns.
 */
export async function GET() {
  const store = storeReadable();
  const res = await eodhdFetch("user", {}).catch(() => null); // the free endpoint
  const u = res?.ok ? ((await res.json().catch(() => null)) as UserAnswer | null) : null;
  const number = (v: unknown) => (typeof v === "number" ? v : null);
  const body = {
    ok: store && u !== null,
    // Which build is live: the commit Vercel built it from, or "local" off the host. After a
    // rollback this is how you see it took (RUNBOOK.md).
    commit: (process.env.VERCEL_GIT_COMMIT_SHA || "local").slice(0, 7),
    store: store ? "up" : "down",
    upstream: u ? "up" : "down",
    calls_used: number(u?.apiRequests),
    daily_limit: number(u?.dailyRateLimit),
  };
  return Response.json(body, {
    status: body.ok ? 200 : 503,
    headers: { "cache-control": "no-store" },
  });
}
