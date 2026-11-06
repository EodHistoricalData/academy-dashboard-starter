/**
 * Writing a document through /api/store from the browser: the version that was read goes
 * with it, and the three answers that matter come back named. The fetch is a parameter so
 * the tests can play the server, including the server that says another tab got there first.
 */
export type PutOutcome =
  | { kind: "saved"; version: number }
  /** Another tab saved first. `current` is what it saved, so the caller can show it. */
  | { kind: "conflict"; current: { version: number; payload: unknown } | null }
  | { kind: "failed"; status: number | null };

export async function putDocViaRoute(
  docKey: string,
  version: number,
  payload: unknown,
  fetcher: typeof fetch = fetch,
): Promise<PutOutcome> {
  try {
    const res = await fetcher(`/api/store/${docKey}`, {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ version, payload }),
    });
    if (res.status === 409) {
      const body = (await res.json()) as { current?: { version: number; payload: unknown } };
      return { kind: "conflict", current: body.current ?? null };
    }
    if (!res.ok) return { kind: "failed", status: res.status };
    return { kind: "saved", version: ((await res.json()) as { version: number }).version };
  } catch {
    return { kind: "failed", status: null }; // the store could not be reached
  }
}
