import { describe, expect, it } from "vitest";
import { createVercelApp } from "./vercelApp";

describe("Vercel backend entry", () => {
  it("creates an Express application that can handle the pilot API", () => {
    const app = createVercelApp();

    expect(typeof app).toBe("function");
    expect(typeof app.handle).toBe("function");
  });
});
