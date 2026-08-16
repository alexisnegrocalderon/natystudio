import { describe, expect, it, vi } from "vitest";
import handler from "./pilot-services";

function createResponse() {
  const response = {
    setHeader: vi.fn(),
    status: vi.fn(),
    json: vi.fn(),
  };
  response.status.mockReturnValue(response);
  return response;
}

describe("pilot-services serverless endpoint", () => {
  it("returns a safe configuration error when the preview has no Neon secret", async () => {
    const original = process.env.NEON_DATABASE_URL;
    delete process.env.NEON_DATABASE_URL;
    const response = createResponse();

    await handler({ method: "GET" }, response);

    expect(response.status).toHaveBeenCalledWith(503);
    expect(response.json).toHaveBeenCalledWith({ error: "pilot_database_not_configured" });
    process.env.NEON_DATABASE_URL = original;
  });
});
