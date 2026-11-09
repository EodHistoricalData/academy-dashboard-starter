import type { Failure } from "@/lib/failure";

/**
 * The notices both pages share: mock mode, no key, and a named failure. Each says what
 * happened and what to do next; a blank panel is the one outcome that teaches nothing.
 */

export function NoKey() {
  return (
    <section className="rounded-lg border border-amber-300 bg-amber-50 p-4 text-sm dark:border-amber-900/60 dark:bg-amber-950/30">
      <h2 className="font-semibold text-amber-900 dark:text-amber-200">
        No key found
      </h2>
      <ol className="mt-2 list-decimal space-y-1 pl-5 text-amber-900 dark:text-amber-200">
        <li>
          Copy <Code>.env.example</Code> to <Code>.env.local</Code>.
        </li>
        <li>
          Put your key in it, on the key’s line. A free one is at{" "}
          <a
            href="https://eodhd.com"
            target="_blank"
            rel="noopener noreferrer"
            className="underline underline-offset-2"
          >
            eodhd.com
          </a>
          .
        </li>
        <li>Restart the dev server.</li>
      </ol>
      <p className="mt-3 text-amber-900 dark:text-amber-200">
        Deployed on Vercel? Set the same variable in the project&apos;s
        environment settings and redeploy.
      </p>
      <p className="mt-3 text-amber-900 dark:text-amber-200">
        No key yet? Put <Code>EODHD_MOCK=1</Code> in <Code>.env.local</Code> to
        see the page on sample data.
      </p>
    </section>
  );
}

export function MockMode() {
  return (
    // Said first and plainly: invented numbers that look live are worse than no numbers.
    <section className="rounded-lg border border-zinc-300 bg-white p-4 text-sm dark:border-zinc-700 dark:bg-zinc-900">
      <h2 className="font-semibold">Mock mode</h2>
      <p className="mt-1 text-zinc-600 dark:text-zinc-400">
        <Code>EODHD_MOCK</Code> is on. Everything below comes from the files in{" "}
        <Code>fixtures/</Code>: invented numbers in EODHD’s format, not market
        data. No API calls are spent. Remove the variable and restart to go live.
      </p>
    </section>
  );
}

export function CallFailed({
  failure,
}: {
  failure: Exclude<Failure, { kind: "no-key" }>;
}) {
  const { title, steps } = explain(failure);
  return (
    // Each failure names itself and the next step. "Something went wrong" over all of
    // them sends you looking in the wrong place for an hour.
    <section className="rounded-lg border border-zinc-300 bg-white p-4 text-sm dark:border-zinc-700 dark:bg-zinc-900">
      <h2 className="font-semibold">{title}</h2>
      <ul className="mt-2 list-disc space-y-1 pl-5 text-zinc-600 dark:text-zinc-400">
        {steps.map((step, i) => (
          <li key={i}>{step}</li>
        ))}
      </ul>
    </section>
  );
}

function explain(failure: Exclude<Failure, { kind: "no-key" }>): {
  title: string;
  steps: React.ReactNode[];
} {
  switch (failure.kind) {
    case "rejected":
      return failure.status === 401
        ? {
            title: "EODHD rejected the key (401)",
            steps: [
              "The API answers the same way for a revoked key and a mistyped one.",
              <>
                Check the key in <Code>.env.local</Code>{" "}
                character by character, or in your host’s settings, then
                restart.
              </>,
            ],
          }
        : {
            title: "Your plan does not cover this request (403)",
            steps: [
              "The key works; the request asks for an exchange, feed or endpoint the plan does not include.",
              "Take out what you added last, one thing at a time, to find which.",
            ],
          };
    case "quota":
      return {
        title: "Today’s API calls are spent (402)",
        steps: [
          "Nothing is broken. The count resets at midnight GMT, and retrying before then only fails again.",
          <>
            Put <Code>EODHD_MOCK=1</Code> in <Code>.env.local</Code> to keep
            working on fixtures meanwhile.
          </>,
        ],
      };
    case "rate-limit":
      return {
        title: "Too many requests in one minute (429)",
        steps: [
          `This clears by itself: wait ${failure.retryAfter ?? "60"} seconds and reload.`,
          "Something is probably fetching in a loop.",
        ],
      };
    case "not-found":
      return {
        title: "EODHD does not know what was asked for (404)",
        steps: [failure.detail, "Check the ticker, including its exchange suffix."],
      };
    case "held":
      // Only a browser request through the proxy is held back; listed so the page can say it.
      return {
        title: "Held back to save today’s calls",
        steps: [failure.detail, "A refresh you press is still served until the limit."],
      };
    case "unreachable":
      return {
        title:
          failure.status === null
            ? "Could not reach EODHD"
            : `EODHD answered ${failure.status}`,
        steps: [
          "The request failed, timed out after 15 seconds, or came back in a shape the page does not read.",
          "Check your connection and reload. If it persists, the API status is the next place to look.",
        ],
      };
  }
}

export function Code({ children }: { children: React.ReactNode }) {
  return (
    <code className="rounded bg-zinc-100 px-1 py-0.5 font-mono text-[0.85em] text-zinc-900 dark:bg-zinc-800 dark:text-zinc-100">
      {children}
    </code>
  );
}

/**
 * Who the documents on this page belong to. Said whenever it is not a real sign-in, so an
 * assumed user never looks like an account.
 */
export function UserLine({
  user,
}: {
  user: { id: number; assumed: boolean } | null;
}) {
  if (user && !user.assumed) return null;
  return (
    <p className="text-xs text-zinc-500 dark:text-zinc-400">
      {user ? (
        <>
          Mock mode with no <Code>DASHBOARD_PASSWORD</Code>: saving as user 1
          without a sign-in. Set a password and <Code>SESSION_SECRET</Code> to
          sign in for real.
        </>
      ) : (
        <>
          Not signed in: what you save stays in this browser.{" "}
          <a href="/login" className="underline underline-offset-2">
            Sign in
          </a>{" "}
          to keep it on the server.
        </>
      )}
    </p>
  );
}

/** The store could not be read: what is shown is a default, and changes may not be kept. */
export function StoreNotice({ error }: { error: string | null }) {
  if (!error) return null;
  return (
    <p className="rounded border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900 dark:border-amber-900/60 dark:bg-amber-950/30 dark:text-amber-200">
      {error} What you see uses defaults; changes may not be kept until it answers.
    </p>
  );
}

