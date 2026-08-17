import { describe, expect, it } from "vitest";
import { validateNataliaAvailability } from "./nataliaAdmin";

describe("validateNataliaAvailability", () => {
  it("normaliza un horario disponible válido", () => {
    expect(validateNataliaAvailability({
      startsAt: "2026-08-18T14:00:00-04:00",
      endsAt: "2026-08-18T14:30:00-04:00",
      note: "  Evaluación inicial  ",
    })).toEqual({
      startsAt: "2026-08-18T18:00:00.000Z",
      endsAt: "2026-08-18T18:30:00.000Z",
      note: "Evaluación inicial",
    });
  });

  it("rechaza horarios sin término posterior", () => {
    expect(() => validateNataliaAvailability({
      startsAt: "2026-08-18T14:30:00-04:00",
      endsAt: "2026-08-18T14:00:00-04:00",
    })).toThrow("El horario seleccionado no es válido.");
  });
});
