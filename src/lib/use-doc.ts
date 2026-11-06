import { useRef, useState } from "react";
import { putDocViaRoute } from "@/lib/doc-client";
import { useStored, writeStored } from "@/lib/stored";

/** A document as the server holds it, or null when it has none for this user. */
export type ServerDoc = { version: number; payload: unknown } | null;

export type SaveStatus =
  | "idle"
  | "saving"
  | "saved"
  /** Another tab saved first; what is shown is now its version. */
  | "conflict"
  /** The server could not be reached; the change is in this browser only. */
  | "failed"
  /** Not signed in: the change is in this browser only. */
  | "local";

/**
 * Step 1 of 3 of moving a document off the browser: read from the server, fall back to
 * this browser's copy only when the server has nothing, and write to both.
 *
 *   1. read server, fall back to local      <- this hook
 *   2. upload local once, then set a flag    (after a day of using step 1)
 *   3. remove the fallback                   (after seeing step 2 work on two devices)
 *
 * Writes carry the version that was read and go out one at a time, so fast edits (a note
 * typed key by key) never race each other into a 409; only a write from another tab does.
 * When several edits queue up, only the newest is sent.
 */
export function useDoc(opts: {
  /** The server document, e.g. "saved-screens". */
  docKey: string;
  /** This browser's copy, e.g. "screens-v1". */
  localKey: string;
  /** What the server had when the page was rendered. */
  initial: ServerDoc;
  signedIn: boolean;
}): {
  /** The document: the server's when it has one, this browser's otherwise. */
  raw: unknown;
  fromServer: boolean;
  status: SaveStatus;
  save(next: unknown): void;
} {
  const local = useStored(opts.localKey);
  const [server, setServer] = useState<ServerDoc>(opts.initial);
  const [status, setStatus] = useState<SaveStatus>("idle");
  const version = useRef(opts.initial?.version ?? 0);
  const queue = useRef<Promise<void>>(Promise.resolve());
  const newest = useRef<unknown>(undefined);

  function save(next: unknown) {
    writeStored(opts.localKey, JSON.stringify(next)); // until step 3 removes the fallback
    if (!opts.signedIn) {
      setStatus("local");
      return;
    }
    setServer({ version: version.current, payload: next }); // shown at once
    setStatus("saving");
    newest.current = next;
    queue.current = queue.current.then(async () => {
      if (newest.current !== next) return; // a newer edit is queued behind this one
      const outcome = await putDocViaRoute(opts.docKey, version.current, next);
      if (outcome.kind === "conflict") {
        if (outcome.current) {
          version.current = outcome.current.version;
          setServer(outcome.current);
        }
        setStatus("conflict");
      } else if (outcome.kind === "failed") {
        setStatus("failed");
      } else {
        version.current = outcome.version;
        if (newest.current === next) setStatus("saved");
      }
    });
  }

  return {
    raw: server ? server.payload : parseJson(local),
    fromServer: server !== null,
    status,
    save,
  };
}

function parseJson(text: string | null): unknown {
  try {
    return JSON.parse(text ?? "null");
  } catch {
    return null;
  }
}

/** A sentence for the save status, or null when there is nothing to say. */
export function statusLine(status: SaveStatus): string | null {
  switch (status) {
    case "saving":
      return "Saving…";
    case "saved":
      return "Saved to your account.";
    case "conflict":
      return "Your other tab saved first; this now shows its version. Make your change again.";
    case "failed":
      return "Could not reach the server; the change is in this browser only.";
    case "local":
      return "Not signed in: kept in this browser only.";
    default:
      return null;
  }
}
