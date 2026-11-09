import { afterEach, describe, expect, it, vi } from "vitest";
import { configProblem } from "@/lib/eodhd";
import { register } from "@/instrumentation";

describe("configProblem", () => {
  it("is nothing to say when mock mode is on, key or no key", () => {
    expect(configProblem({ EODHD_MOCK: "1" })).toBeNull();
    expect(configProblem({ EODHD_MOCK: "true", EODHD_API_KEY: "" })).toBeNull();
  });

  it("is nothing to say when the key holds a real value", () => {
    expect(configProblem({ EODHD_API_KEY: "a-key-of-the-right-length" })).toBeNull();
  });

  it("names the variable, the file to copy and mock mode when there is no real key", () => {
    for (const env of [
      {},
      { EODHD_API_KEY: "" },
      { EODHD_API_KEY: "   " },
      { EODHD_API_KEY: "your_key_here" }, // the old placeholder
      { EODHD_MOCK: "0", EODHD_API_KEY: "" },
    ]) {
      const problem = configProblem(env);
      expect(problem).toContain("EODHD_API_KEY");
      expect(problem).toContain(".env.example");
      expect(problem).toContain("EODHD_MOCK=1");
    }
  });
});

describe("register", () => {
  afterEach(() => vi.unstubAllEnvs());

  it("stops the server before any request when the key is missing", async () => {
    vi.stubEnv("NEXT_RUNTIME", "nodejs");
    vi.stubEnv("EODHD_MOCK", "");
    vi.stubEnv("EODHD_API_KEY", "");
    await expect(register()).rejects.toThrow(/EODHD_API_KEY is not set/);
  });

  it("starts in mock mode without a key", async () => {
    vi.stubEnv("NEXT_RUNTIME", "nodejs");
    vi.stubEnv("EODHD_MOCK", "1");
    vi.stubEnv("EODHD_API_KEY", "");
    await expect(register()).resolves.toBeUndefined();
  });
});
