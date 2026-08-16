import { neon } from "@neondatabase/serverless";
import { describe, expect, it } from "vitest";

describe("Neon staging connection", () => {
  it("executes a lightweight health query with the configured server-only secret", async () => {
    const connectionString = process.env.NEON_DATABASE_URL;

    expect(connectionString).toMatch(/^postgres(?:ql)?:\/\//);

    const sql = neon(connectionString!);
    const result = await sql`SELECT 1 AS connected`;

    expect(result).toEqual([{ connected: 1 }]);
  }, 15_000);
});
