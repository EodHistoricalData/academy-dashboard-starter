import { describe, expect, it } from "vitest";
import { makeSession, passwordMatches, readSession } from "@/lib/session";

const SECRET = "test-secret-not-a-real-one";
const NOW = Date.UTC(2026, 10, 6);

describe("the session cookie", () => {
  it("reads back a session it signed", () => {
    const value = makeSession({ uid: 1, exp: NOW + 1000 }, SECRET);
    expect(readSession(value, SECRET, NOW)).toEqual({ uid: 1, exp: NOW + 1000 });
  });

  it("refuses one signed with another secret, or edited after signing", () => {
    const value = makeSession({ uid: 1, exp: NOW + 1000 }, SECRET);
    expect(readSession(value, "another-secret", NOW)).toBeNull();
    const [, mac] = value.split(".");
    const forged = `${Buffer.from(JSON.stringify({ uid: 2, exp: NOW + 1000 })).toString("base64url")}.${mac}`;
    expect(readSession(forged, SECRET, NOW)).toBeNull();
  });

  it("refuses an expired one, and anything when no secret is set", () => {
    expect(readSession(makeSession({ uid: 1, exp: NOW - 1 }, SECRET), SECRET, NOW)).toBeNull();
    expect(readSession(makeSession({ uid: 1, exp: NOW + 1 }, SECRET), undefined, NOW)).toBeNull();
    expect(readSession("garbage", SECRET, NOW)).toBeNull();
  });
});

describe("the password", () => {
  it("matches only the configured one, and nothing when none is configured", () => {
    expect(passwordMatches("correct horse", "correct horse")).toBe(true);
    expect(passwordMatches("correct hors", "correct horse")).toBe(false);
    expect(passwordMatches("", undefined)).toBe(false);
  });
});
