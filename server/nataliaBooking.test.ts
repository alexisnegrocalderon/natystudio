import { describe, expect, it } from "vitest";
import { validateBookingConfirmation, validateWaitlistJoin } from "./nataliaBooking";

describe("validateBookingConfirmation", () => {
  const validInput = {
    holdToken: "hold_123",
    serviceSlug: "retiro-acrocordones",
    fullName: "  Camila Soto  ",
    email: "CAMILA@EXAMPLE.COM ",
    whatsapp: "+56 9 1234 5678",
    idempotencyKey: "booking_123",
    note: "  Primera evaluación  ",
  };

  it("normaliza los datos de la reserva sin exponer datos de pago", () => {
    expect(validateBookingConfirmation(validInput)).toEqual({
      holdToken: "hold_123",
      serviceSlug: "retiro-acrocordones",
      fullName: "Camila Soto",
      email: "camila@example.com",
      whatsapp: "+56912345678",
      note: "Primera evaluación",
      idempotencyKey: "booking_123",
    });
  });

  it("rechaza un correo o teléfono inválido", () => {
    expect(() => validateBookingConfirmation({ ...validInput, email: "no-es-correo" })).toThrow("El correo no es válido.");
    expect(() => validateBookingConfirmation({ ...validInput, whatsapp: "123" })).toThrow("El teléfono no es válido.");
  });
});

describe("validateWaitlistJoin", () => {
  it("normaliza una solicitud consentida sin requerir acceso a la base", () => {
    expect(validateWaitlistJoin({
      fullName: "  Daniela Rojas ",
      email: "DANIELA@EXAMPLE.COM ",
      whatsapp: "+56 9 8765 4321",
      serviceSlug: " retiro-acrocordones ",
      consentEmail: true,
    })).toEqual({
      fullName: "Daniela Rojas",
      email: "daniela@example.com",
      whatsapp: "+56987654321",
      serviceSlug: "retiro-acrocordones",
    });
  });

  it("exige consentimiento expreso antes de registrar avisos", () => {
    expect(() => validateWaitlistJoin({
      fullName: "Daniela Rojas",
      email: "daniela@example.com",
      consentEmail: false,
    })).toThrow("Debes aceptar recibir avisos de disponibilidad");
  });
});
