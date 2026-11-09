import type { NextRequest } from "next/server";
import { proxy } from "@/lib/proxy";
import { readSession, SESSION_COOKIE } from "@/lib/session";

// The key lives only on the server, so this must run in the Node.js runtime and
// never be statically cached with a token baked in.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Server-side proxy to the EODHD REST API.
 *
 *   GET /api/proxy/eod/AAPL.US?period=d  ->  https://eodhd.com/api/eod/AAPL.US?period=d&api_token=<server key>
 *
 * The browser never sees the key. Any client-supplied `api_token` is dropped, only the
 * endpoints in ALLOWED_ENDPOINTS are forwarded, and a 429 comes back with Retry-After and
 * a sentence saying what happened. The rules live in src/lib/proxy.ts, where the tests
 * can reach them. GET only.
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ path: string[] }> },
) {
  const { path } = await params;
  // With a password set, the tool has an owner, and the proxy spends the owner's calls for
  // the owner only: a visitor who has not signed in gets nothing upstream. Without one (mock
  // mode, the course) it stays open, as the cockpit and the pages are.
  if (
    process.env.DASHBOARD_PASSWORD &&
    !readSession(req.cookies.get(SESSION_COOKIE)?.value, process.env.SESSION_SECRET, Date.now())
  ) {
    return Response.json(
      { error: "Sign in at /login first: this proxy spends the owner's API calls.", kind: "signed-out" },
      { status: 401, headers: { "cache-control": "no-store" } },
    );
  }
  // The first address in x-forwarded-for, for the per-address limit in src/lib/proxy.ts.
  const caller = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
  return proxy(path, new URL(req.url).searchParams, caller, req.headers.get("x-budget"));
}
