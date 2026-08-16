import { describe, expect, it } from "vitest";
import { getPilotOverview, listPilotServices, normalizeWhatsApp } from "./nataliaPilot";

describe("natalia pilot helpers", () => {
  it("normalizes WhatsApp numbers without changing the leading country prefix", () => {
    expect(normalizeWhatsApp("+56 9 1234 5678")).toBe("+56912345678");
    expect(normalizeWhatsApp("0056-9-1234-5678")).toBe("+56912345678");
  });

  it("reads the seeded catalogue and isolated reporting overview from staging", async () => {
    const [services, overview] = await Promise.all([listPilotServices(), getPilotOverview()]);

    expect(services).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ slug: "retiro-acrocordones", name: "Retiro de acrocordones" }),
      ]),
    );
    expect(overview).toMatchObject({
      activeServices: 1,
      clientCount: 0,
      pendingBookings: 0,
      blockedNotifications: 0,
      integrations: { mailing: "manual_required", payments: "blocked", whatsapp: "blocked" },
    });
  }, 15_000);
});
