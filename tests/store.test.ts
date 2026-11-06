import { afterEach, describe, expect, it, vi } from "vitest";
import { openStore, putDoc } from "@/lib/store";

// The route reads the current user from one place; the test decides who that is.
const as = vi.hoisted(() => ({ id: 1 }));
vi.mock("@/lib/user", () => ({
  currentUser: async () => ({ id: as.id, assumed: false }),
}));

const { GET, PUT } = await import("@/app/api/store/[key]/route");

function call(method: "GET" | "PUT", key: string, body?: unknown) {
  const req = new Request(`http://localhost/api/store/${key}`, {
    method,
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const ctx = { params: Promise.resolve({ key }) };
  return method === "GET" ? GET(req, ctx) : PUT(req, ctx);
}

afterEach(() => {
  as.id = 1;
});

describe("the store", () => {
  it("refuses a write made from a stale version: the other tab is ahead", () => {
    const s = openStore(":memory:");
    expect(s.putDoc(1, "saved-screens", { a: 1 }, 0)).toEqual({ conflict: false, version: 1 });
    expect(s.putDoc(1, "saved-screens", { a: 2 }, 1)).toEqual({ conflict: false, version: 2 });
    const stale = s.putDoc(1, "saved-screens", { a: 3 }, 1);
    expect(stale).toMatchObject({ conflict: true, current: { version: 2, payload: { a: 2 } } });
    expect(s.getDoc(1, "saved-screens")?.payload).toEqual({ a: 2 });
  });

  it("refuses a first write when a document appeared meanwhile", () => {
    const s = openStore(":memory:");
    s.putDoc(1, "notes", { x: 1 }, 0);
    expect(s.putDoc(1, "notes", { x: 2 }, 0).conflict).toBe(true);
  });

  it("keeps each user's documents apart", () => {
    const s = openStore(":memory:");
    s.putDoc(1, "shortlist", { mine: true }, 0);
    expect(s.getDoc(2, "shortlist")).toBeNull();
  });
});

describe("the route", () => {
  it("answers 404 for another user's document, not 403", async () => {
    putDoc(1, "saved-screens", { "Big and profitable": {} }, 0);
    as.id = 2;
    const res = await call("GET", "saved-screens");
    expect(res.status).toBe(404);
  });

  it("answers 409 for a stale version and 200 for the current one", async () => {
    as.id = 7;
    expect((await call("PUT", "notes", { version: 0, payload: {} })).status).toBe(200);
    expect((await call("PUT", "notes", { version: 0, payload: {} })).status).toBe(409);
    const ok = await call("PUT", "notes", { version: 1, payload: { "AAPL.US": { note: "x" } } });
    expect(await ok.json()).toEqual({ version: 2 });
  });

  it("has only the documents it lists", async () => {
    expect((await call("GET", "anything-else")).status).toBe(404);
    expect((await call("PUT", "anything-else", { version: 0, payload: 1 })).status).toBe(404);
  });
});
