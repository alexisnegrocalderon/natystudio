import { beforeEach, describe, expect, it, vi } from "vitest";

const { sql } = vi.hoisted(() => ({ sql: vi.fn() }));

vi.mock("@neondatabase/serverless", () => ({
  neon: () => sql,
}));

import { createPilotBooking } from "./nataliaPilot";

describe("natalia pilot reservations", () => {
  beforeEach(() => {
    process.env.NEON_DATABASE_URL = "postgres://pilot-test";
    sql.mockReset();
  });

  it("creates the client, booking and blocked notification only after the service is available", async () => {
    sql
      .mockResolvedValueOnce([{ id: 9 }])
      .mockResolvedValueOnce([{ id: 41 }])
      .mockResolvedValueOnce([{ id: 72, status: "pending", createdAt: "2026-08-16T00:00:00.000Z" }])
      .mockResolvedValueOnce([]);

    await expect(
      createPilotBooking({
        fullName: "Paciente de prueba",
        whatsapp: "+56 9 1234 5678",
        serviceSlug: "retiro-acrocordones",
      }),
    ).resolves.toMatchObject({ id: 72, status: "pending" });

    expect(sql).toHaveBeenCalledTimes(4);
  });

  it("rejects an unavailable service before creating a client or outbox event", async () => {
    sql.mockResolvedValueOnce([]);

    await expect(
      createPilotBooking({
        fullName: "Paciente de prueba",
        whatsapp: "+56 9 1234 5678",
        serviceSlug: "servicio-inexistente",
      }),
    ).rejects.toThrow("no está disponible");

    expect(sql).toHaveBeenCalledTimes(1);
  });
});
