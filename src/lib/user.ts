import { cookies } from "next/headers";
import { isMock } from "@/lib/eodhd";
import { readSession, SESSION_COOKIE } from "@/lib/session";

/**
 * Where the current user comes from: the one place, so every store read and write can be
 * scoped by it.
 *
 * This tool has one owner. Signing in at /login with DASHBOARD_PASSWORD sets a signed
 * session cookie for user 1. In mock mode with no password configured, user 1 is assumed so
 * the course runs without setup, and the pages say so; outside mock mode nobody is assumed.
 */
export type User = { id: number; assumed: boolean };

export async function currentUser(): Promise<User | null> {
  const jar = await cookies();
  const session = readSession(
    jar.get(SESSION_COOKIE)?.value,
    process.env.SESSION_SECRET,
    Date.now(),
  );
  if (session) return { id: session.uid, assumed: false };
  if (isMock() && !process.env.DASHBOARD_PASSWORD) return { id: 1, assumed: true };
  return null;
}
