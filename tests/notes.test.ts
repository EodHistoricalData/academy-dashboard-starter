import { afterEach, describe, expect, it, vi } from "vitest";
import { loadNotes, withNote } from "@/lib/notes";

function stored(value: string | null) {
  vi.stubGlobal("localStorage", { getItem: () => value });
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("loadNotes", () => {
  it("returns an empty object for broken JSON instead of throwing", () => {
    // Half a write from a crashed tab.
    stored('{"AAPL.US":{"note":"Bought at 2');
    expect(loadNotes()).toEqual({});
  });

  it("returns an empty object when storage holds valid JSON of the wrong shape", () => {
    stored("null");
    expect(loadNotes()).toEqual({});
    stored("[1,2]");
    expect(loadNotes()).toEqual({});
  });

  it("returns an empty object when nothing has been saved", () => {
    stored(null);
    expect(loadNotes()).toEqual({});
  });

  it("returns notes keyed by ticker", () => {
    stored('{"AAPL.US":{"note":"Bought at 291, thesis is services margin"}}');
    expect(loadNotes()).toEqual({
      "AAPL.US": { note: "Bought at 291, thesis is services margin" },
    });
  });
});

describe("withNote", () => {
  it("changes one ticker's note and leaves the others", () => {
    const notes = { "AAPL.US": { note: "a" }, "MSFT.US": { note: "m" } };
    expect(withNote(notes, "AAPL.US", "b")).toEqual({
      "AAPL.US": { note: "b" },
      "MSFT.US": { note: "m" },
    });
    expect(notes["AAPL.US"].note).toBe("a");
  });

  it("drops the entry when the note is cleared", () => {
    expect(withNote({ "AAPL.US": { note: "a" } }, "AAPL.US", "")).toEqual({});
  });
});
