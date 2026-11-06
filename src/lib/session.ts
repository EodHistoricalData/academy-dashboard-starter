import { createHash, createHmac, timingSafeEqual } from "node:crypto";

/**
 * A signed session cookie for one owner, with nothing added to package.json.
 *
 * The cookie holds `{uid, exp}` as base64url, a dot, and an HMAC-SHA256 of that text keyed
 * by SESSION_SECRET. Anyone can read it; nobody without the secret can make one the server
 * will accept, or stretch its expiry. Both values live in .env.local and the host's
 * settings, never in a NEXT_PUBLIC_ variable.
 */
export const SESSION_COOKIE = "session";
export const SESSION_DAYS = 30;

export type Session = { uid: number; exp: number };

function sign(text: string, secret: string): string {
  return createHmac("sha256", secret).update(text).digest("base64url");
}

export function makeSession(session: Session, secret: string): string {
  const body = Buffer.from(JSON.stringify(session)).toString("base64url");
  return `${body}.${sign(body, secret)}`;
}

/** The session in a cookie value, or null if it is forged, malformed or expired. */
export function readSession(
  value: string | undefined,
  secret: string | undefined,
  nowMs: number,
): Session | null {
  if (!value || !secret) return null;
  const [body, mac] = value.split(".");
  if (!body || !mac || !same(mac, sign(body, secret))) return null;
  try {
    const s = JSON.parse(Buffer.from(body, "base64url").toString("utf8")) as Session;
    return Number.isInteger(s.uid) && typeof s.exp === "number" && s.exp > nowMs
      ? { uid: s.uid, exp: s.exp }
      : null;
  } catch {
    return null;
  }
}

/**
 * Whether a typed password matches the configured one, in time that does not depend on how
 * much of it was right. Both are hashed first so the comparison is always 32 bytes.
 */
export function passwordMatches(typed: string, configured: string | undefined): boolean {
  if (!configured) return false;
  return same(digest(typed), digest(configured));
}

function digest(text: string): string {
  return createHash("sha256").update(text).digest("base64url");
}

function same(a: string, b: string): boolean {
  const x = Buffer.from(a);
  const y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
}
