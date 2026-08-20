import { eodhdFetch } from "@/lib/eodhd";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * The "wall-meter": your plan and how many API calls you have used today.
 * Backs the "keep your tool real" upgrade moment in the course. Surfaces only
 * the meter fields, never the token, invite code, or email.
 */
export async function GET() {
  try {
    const res = await eodhdFetch("user", {});
    if (!res.ok) {
      return Response.json({ error: `EODHD ${res.status}` }, { status: res.status });
    }
    const u = (await res.json()) as {
      subscriptionType?: string;
      name?: string;
      apiRequests?: number;
      dailyRateLimit?: number;
    };

    const used = typeof u.apiRequests === "number" ? u.apiRequests : null;
    const limit = typeof u.dailyRateLimit === "number" ? u.dailyRateLimit : null;

    return Response.json({
      plan: u.subscriptionType ?? "unknown",
      used,
      dailyLimit: limit,
      remaining: used !== null && limit !== null ? Math.max(0, limit - used) : null,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "usage error";
    return Response.json({ error: message }, { status: 502 });
  }
}
