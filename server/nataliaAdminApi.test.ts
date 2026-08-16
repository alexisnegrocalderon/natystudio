import { describe, expect, it } from "vitest";
import { loginNataliaAdmin } from "./nataliaAdminApi";

function mockResponse() {
  return {
    statusCode: 0,
    body: undefined as unknown,
    setHeader() {},
    status(code: number) { this.statusCode = code; return this; },
    json(body: unknown) { this.body = body; },
  };
}

describe("natalia admin API", () => {
  it("rejects unsupported methods before reading credentials", async () => {
    const response = mockResponse();
    await loginNataliaAdmin({ method: "GET", headers: {} }, response);
    expect(response.statusCode).toBe(405);
    expect(response.body).toEqual({ error: "method_not_allowed" });
  });
});
