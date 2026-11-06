"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import {
  makeSession,
  passwordMatches,
  SESSION_COOKIE,
  SESSION_DAYS,
} from "@/lib/session";

/**
 * Sign the owner in. The password is compared on the server in constant time; on success a
 * signed, httpOnly cookie for user 1 is set and the browser goes to the dashboard.
 */
export async function signIn(
  _previous: string | null,
  form: FormData,
): Promise<string | null> {
  const password = process.env.DASHBOARD_PASSWORD;
  const secret = process.env.SESSION_SECRET;
  if (!password || !secret) {
    return "Sign-in is not set up: put DASHBOARD_PASSWORD and SESSION_SECRET in .env.local and restart.";
  }
  const typed = form.get("password");
  if (typeof typed !== "string" || !passwordMatches(typed, password)) {
    return "That is not the password.";
  }

  const exp = Date.now() + SESSION_DAYS * 24 * 60 * 60 * 1000;
  (await cookies()).set(SESSION_COOKIE, makeSession({ uid: 1, exp }, secret), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    expires: new Date(exp),
  });
  redirect("/dashboard");
}
