import { describe, expect, it, vi } from "vitest";
import { readDocFrom, type Store } from "@/lib/store";

vi.mock("@/lib/user", () => ({ currentUser: async () => ({ id: 1, assumed: false }) }));
vi.mock("@/lib/store", async (original) => ({
  ...(await original<typeof import("@/lib/store")>()),
  // A database that is locked or on a read-only disk.
  putDoc: () => {
    throw new Error("attempt to write a readonly database");
  },
}));

const { PUT } = await import("@/app/api/store/[key]/route");

const broken: Store = {
  getDoc: () => {
    throw new Error("unable to open database file");
  },
  putDoc: () => {
    throw new Error("unable to open database file");
  },
};

describe("a store that cannot be reached", () => {
  it("gives no document on read and says why, instead of failing the page", () => {
    expect(readDocFrom(broken, 1, "layouts")).toEqual({
      doc: null,
      error: "The store could not be read (unable to open database file).",
    });
  });

  it("answers a write with 503 and a sentence, not a bare 500", async () => {
    const res = await PUT(
      new Request("http://localhost/api/store/layouts", {
        method: "PUT",
        body: JSON.stringify({ version: 0, payload: {} }),
      }),
      { params: Promise.resolve({ key: "layouts" }) },
    );
    expect(res.status).toBe(503);
    expect((await res.json()).error).toMatch(/store could not save/);
  });
});
