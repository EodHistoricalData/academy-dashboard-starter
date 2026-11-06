import { describe, expect, it, vi } from "vitest";
import { DEFAULT_LAYOUT } from "@/lib/layout";
import { putDoc } from "@/lib/store";

// Test as the other person, because you always test as yourself.
vi.mock("@/lib/user", () => ({ currentUser: async () => ({ id: 2, assumed: false }) }));

const { GET } = await import("@/app/api/store/[key]/route");

const get = (key: string) =>
  GET(new Request(`http://localhost/api/store/${key}`), { params: Promise.resolve({ key }) });

describe("another user's documents", () => {
  it("does not reveal that another user's layouts exist", async () => {
    putDoc(1, "layouts", { morning: DEFAULT_LAYOUT }, 0);
    expect((await get("layouts")).status).toBe(404); // a 403 would confirm the document is there
  });

  it("does not reveal that another user's rules exist", async () => {
    putDoc(1, "rules", [], 0);
    expect((await get("rules")).status).toBe(404);
  });
});
