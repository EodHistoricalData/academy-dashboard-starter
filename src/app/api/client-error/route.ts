import type { NextRequest } from "next/server";
import { logEvent } from "@/lib/log";
import { allow } from "@/lib/rate-limit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Reports per address in the last minute: a crash loop in one tab must not flood the log.
const hits = new Map<string, number[]>();

/**
 * A panel crashed in someone's browser. Without this the error dies in a tab nobody is
 * watching; with it, it is a line in the server log. The message and stack are cut short,
 * and nothing else from the request is kept.
 */
export async function POST(req: NextRequest) {
  const caller = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
  if (!allow(hits, caller, Date.now(), 10)) {
    return Response.json({ error: "Too many reports from this address." }, { status: 429 });
  }
  let report: { message?: unknown; stack?: unknown };
  try {
    report = (await req.json()) as typeof report;
  } catch {
    return Response.json({ error: "Expected JSON with a message." }, { status: 400 });
  }
  if (typeof report?.message !== "string") {
    return Response.json({ error: "Expected JSON with a message." }, { status: 400 });
  }
  logEvent("client_error", {
    message: report.message.slice(0, 500),
    stack: typeof report.stack === "string" ? report.stack.slice(0, 2_000) : null,
  });
  return new Response(null, { status: 204 });
}
