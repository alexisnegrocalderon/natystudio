import { describe, expect, it } from "vitest";
import { buildReminderCopy, isSendingHour, santiagoHour } from "./abandoned-reminders";
import { renderManualMessage } from "./email-templates";

describe("buildReminderCopy", () => {
  const base = { siteUrl: "https://www.retirolunares.cl" };

  it("para un servicio enlaza a la reserva con el servicio ya elegido", () => {
    const copy = buildReminderCopy({
      ...base,
      name: "María José Pérez",
      serviceName: "Retiro de acrocordones",
      serviceSlug: "retiro-de-acrocordones",
      serviceKind: "service",
    });
    expect(copy.subject).toBe("María, Retiro de acrocordones te está esperando");
    expect(copy.body).toContain("Hola María");
    expect(copy.body).toContain("Retiro de acrocordones");
    expect(copy.cta.url).toBe("https://www.retirolunares.cl/reservar?servicios=retiro-de-acrocordones");
  });

  it("para un curso enlaza a la página del curso", () => {
    const copy = buildReminderCopy({ ...base, name: "Ana", serviceName: "Curso online", serviceSlug: "curso-online", serviceKind: "course" });
    expect(copy.cta.url).toBe("https://www.retirolunares.cl/curso");
    expect(copy.body).toContain("el curso Curso online");
  });

  it("sin servicio ni nombre sigue siendo un mensaje válido", () => {
    const copy = buildReminderCopy({ ...base, name: null, serviceName: null, serviceSlug: null, serviceKind: null });
    expect(copy.subject).toBe("Tu reserva quedó a medias");
    expect(copy.body.startsWith("Hola,")).toBe(true);
    expect(copy.cta.url).toBe("https://www.retirolunares.cl/reservar");
  });

  it("el correo renderizado lleva el botón y el enlace en texto plano", () => {
    const copy = buildReminderCopy({ ...base, name: "Ana", serviceName: "Peeling", serviceSlug: "peeling", serviceKind: "service" });
    const mail = renderManualMessage(copy.subject, copy.body, copy.cta);
    expect(mail.html).toContain(copy.cta.url);
    expect(mail.html).toContain("Retomar mi reserva");
    expect(mail.text).toContain(`Retomar mi reserva: ${copy.cta.url}`);
  });
});

describe("horario de envío", () => {
  it("usa la hora de Chile, no la UTC", () => {
    // 2026-11-17 12:00 UTC = 09:00 en Santiago (UTC-3 en verano).
    expect(santiagoHour(new Date("2026-11-17T12:00:00Z"))).toBe(9);
  });

  it("envía de 9:00 a 20:00 y no de madrugada ni de noche", () => {
    expect(isSendingHour(new Date("2026-11-17T12:00:00Z"))).toBe(true); // 09:00
    expect(isSendingHour(new Date("2026-11-17T22:59:00Z"))).toBe(true); // 19:59
    expect(isSendingHour(new Date("2026-11-17T23:00:00Z"))).toBe(false); // 20:00
    expect(isSendingHour(new Date("2026-11-17T06:00:00Z"))).toBe(false); // 03:00
  });
});
