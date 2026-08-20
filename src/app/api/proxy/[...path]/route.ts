import type { NextRequest } from "next/server";
import { eodhdFetch } from "@/lib/eodhd";

// The key lives only on the server, so this must run in the Node.js runtime and
// never be statically cached with a token baked in.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Server-side proxy to the EODHD REST API.
 *
 *   GET /api/proxy/eod/AAPL.US?period=d  ->  https://eodhd.com/api/eod/AAPL.US?period=d&api_token=<server key>
 *
 * The browser never sees the key. Any client-supplied `api_token` is dropped.
 * GET only.
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ path: string[] }> },
) {
  const { path } = await params;
  const target = path.map(encodeURIComponent).join("/");

  const incoming = new URL(req.url).searchParams;
  const passthrough: Record<string, string> = {};
  for (const [key, value] of incoming.entries()) {
    if (key.toLowerCase() === "api_token") continue; // caller cannot set the token
    passthrough[key] = value;
  }

  try {
    const upstream = await eodhdFetch(target, passthrough);
    const body = await upstream.text();
    return new Response(body, {
      status: upstream.status,
      headers: {
        "content-type":
          upstream.headers.get("content-type") ?? "application/json",
        // Short cache to soften the free-tier daily call limit during development.
        "cache-control": "public, max-age=60",
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "proxy error";
    return Response.json({ error: message }, { status: 502 });
  }
}
