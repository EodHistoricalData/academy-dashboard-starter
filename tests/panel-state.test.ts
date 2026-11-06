import { describe, expect, it } from "vitest";
import { failureSentence } from "@/lib/failure";
import { panelState } from "@/lib/panel-state";

const rows = [{ code: "AAPL.US" }];

describe("a panel's five states", () => {
  it("loading: no rows yet, a fetch running", () => {
    expect(panelState({ rows: null, fetching: true, failure: null })).toEqual({ kind: "loading" });
  });

  it("refreshing: keeps the rows it has while a newer fetch runs", () => {
    expect(panelState({ rows, fetching: true, failure: null })).toEqual({ kind: "refreshing", rows });
  });

  it("ready: rows and no fetch running", () => {
    expect(panelState({ rows, fetching: false, failure: null })).toEqual({ kind: "ready", rows });
  });

  it("empty: the request succeeded and there is nothing", () => {
    expect(panelState({ rows: [], fetching: false, failure: null })).toEqual({ kind: "empty" });
  });

  it("failed: says what failed and keeps the old rows on screen", () => {
    const failure = { kind: "quota" } as const;
    expect(panelState({ rows, fetching: false, failure })).toEqual({ kind: "failed", failure, rows });
    expect(panelState({ rows: null, fetching: false, failure })).toEqual({
      kind: "failed",
      failure,
      rows: null,
    });
  });
});

describe("a sentence for each kind of failure", () => {
  it("404: the ticker, named", () => {
    const s = failureSentence({ kind: "not-found", detail: "Ticker Not Found." });
    expect(s.what).toContain("Ticker Not Found.");
    expect(s.next).toMatch(/exchange suffix/);
  });

  it("402: out of calls for today, resets at 00:00 UTC, and the data stays", () => {
    const s = failureSentence({ kind: "quota" });
    expect(s.what).toMatch(/out of API calls for today/);
    expect(s.next).toMatch(/00:00 UTC/);
  });

  it("429: wait as long as Retry-After says, then retry", () => {
    expect(failureSentence({ kind: "rate-limit", retryAfter: "30" }).next).toMatch(/30 seconds/);
  });

  it("403: the plan does not cover it, and waiting will not help", () => {
    expect(failureSentence({ kind: "rejected", status: 403 }).next).toMatch(/Waiting will not help/);
  });

  it("401: the key, checked character by character", () => {
    expect(failureSentence({ kind: "rejected", status: 401 }).what).toMatch(/rejected the key/);
  });

  it("5xx or a timeout: upstream, and retrying is reasonable", () => {
    expect(failureSentence({ kind: "unreachable", status: 503 }).next).toMatch(/retrying is reasonable/);
    expect(failureSentence({ kind: "unreachable", status: null }).what).toMatch(/did not answer/);
  });

  it("no key: where to put it", () => {
    expect(failureSentence({ kind: "no-key" }).next).toMatch(/EODHD_API_KEY/);
  });

  it("never says only that something went wrong", () => {
    const kinds = [
      { kind: "no-key" },
      { kind: "rejected", status: 401 },
      { kind: "rejected", status: 403 },
      { kind: "quota" },
      { kind: "rate-limit", retryAfter: null },
      { kind: "not-found", detail: "x" },
      { kind: "unreachable", status: 500 },
    ] as const;
    for (const k of kinds) expect(JSON.stringify(failureSentence(k))).not.toMatch(/something went wrong/i);
  });
});
