"use client";

import { useActionState } from "react";
import { signIn } from "@/app/login/actions";

export function LoginForm() {
  const [error, action, pending] = useActionState(signIn, null);
  return (
    <form action={action} className="flex flex-col gap-3 text-sm">
      <label className="flex flex-col gap-1">
        Password
        <input
          type="password"
          name="password"
          required
          autoComplete="current-password"
          className="rounded border border-zinc-300 bg-white px-2 py-1.5 dark:border-zinc-700 dark:bg-zinc-900"
        />
      </label>
      <button
        type="submit"
        disabled={pending}
        className="self-start rounded bg-zinc-900 px-3 py-1.5 text-white disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900"
      >
        Sign in
      </button>
      {error && <p className="text-red-700 dark:text-red-400">{error}</p>}
    </form>
  );
}
