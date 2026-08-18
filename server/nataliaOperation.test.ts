import { describe, expect, it } from "vitest";
import { calculateServiceCharge, validateWeeklyScheduleRule } from "./nataliaOperation";

describe("reglas operativas de Natalia", () => {
  it("calcula servicio sin pago y cobros de seña o pago total de forma server-side", () => {
    expect(calculateServiceCharge("none", null, null)).toEqual({ required: false, amountClp: 0 });
    expect(calculateServiceCharge("deposit", 30000, 10000)).toEqual({ required: true, amountClp: 10000 });
    expect(calculateServiceCharge("full_payment", 30000, 10000)).toEqual({ required: true, amountClp: 30000 });
  });

  it("rechaza señas y reglas semanales fuera de rango", () => {
    expect(() => calculateServiceCharge("deposit", 30000, 45000)).toThrow("seña");
    expect(() => validateWeeklyScheduleRule({ weekday: 7, startsMinute: 600, endsMinute: 900, slotDurationMinutes: 30, bufferMinutes: 10, isEnabled: true })).toThrow("día");
  });
});
