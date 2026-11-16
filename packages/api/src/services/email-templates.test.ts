import { describe, expect, it } from "vitest";
import { renderEmail, type TemplateData } from "./email-templates";

const base: TemplateData = {
  customerName: "Alexis Negro",
  serviceName: "Retiro de acrocordones",
  locationName: "Valparaíso",
  locationCity: "Valparaíso",
  startsAt: new Date("2026-11-20T14:00:00Z"),
  endsAt: new Date("2026-11-20T15:00:00Z"),
  durationMin: 60,
  priceClp: 1000,
  amountPaidClp: 1000,
  publicId: "abc123",
  cancelToken: "token",
  siteUrl: "https://www.retirolunares.cl",
  customerEmail: "clienta@example.com",
  customerPhone: "+56911112222",
};

describe("aviso interno a Naty (admin_new_booking)", () => {
  it("con un pago aprobado avisa que la hora quedó confirmada y trae el contacto", () => {
    const mail = renderEmail("admin_new_booking", base);
    expect(mail.subject).toContain("Reserva confirmada");
    expect(mail.html).toContain("reservó y pagó");
    expect(mail.html).toContain("clienta@example.com");
    expect(mail.text).toContain("+56911112222");
  });

  it("sin pago sigue siendo una solicitud de hora", () => {
    const mail = renderEmail("admin_new_booking", { ...base, amountPaidClp: 0 });
    expect(mail.subject).toContain("Nueva reserva");
    expect(mail.html).toContain("solicitó una hora");
    expect(mail.html).not.toContain("reservó y pagó");
  });

  it("no rompe si no hay datos de contacto", () => {
    const mail = renderEmail("admin_new_booking", { ...base, customerEmail: undefined, customerPhone: undefined });
    expect(mail.html).not.toContain("Contacto:");
  });
});
