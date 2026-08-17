import { describe, expect, it } from "vitest";

describe("entrada CommonJS de Vercel", () => {
  it("exporta una función invocable desde el bundle consolidado", async () => {
    const entry = await import("../api/index.js");
    expect(typeof entry.default).toBe("function");
  });
});
