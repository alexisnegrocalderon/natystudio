import { describe, expect, it } from "vitest";
import { chileMidnight, salesPeriodStarts } from "./sales-periods";

describe("límites de ventas en hora de Chile", () => {
  it("medianoche en verano (UTC-3) es a las 03:00 UTC", () => {
    expect(chileMidnight(2026, 11, 17).toISOString()).toBe("2026-11-17T03:00:00.000Z");
  });

  it("medianoche en invierno (UTC-4) es a las 04:00 UTC", () => {
    expect(chileMidnight(2026, 7, 15).toISOString()).toBe("2026-07-15T04:00:00.000Z");
  });

  it("a las 23:30 de Chile del martes 17 de noviembre, hoy sigue siendo el 17 aunque en UTC ya sea 18", () => {
    const now = new Date("2026-11-18T02:30:00Z"); // 23:30 del 17 en Santiago
    const starts = salesPeriodStarts(now);
    expect(starts.today.toISOString()).toBe("2026-11-17T03:00:00.000Z");
    expect(starts.tomorrow.toISOString()).toBe("2026-11-18T03:00:00.000Z");
    expect(starts.week.toISOString()).toBe("2026-11-16T03:00:00.000Z"); // lunes 16
    expect(starts.month.toISOString()).toBe("2026-11-01T03:00:00.000Z");
  });

  it("un domingo cuenta en la semana que empezó el lunes anterior", () => {
    const starts = salesPeriodStarts(new Date("2026-11-22T15:00:00Z")); // domingo 22, 12:00 en Santiago
    expect(starts.week.toISOString()).toBe("2026-11-16T03:00:00.000Z");
  });

  it("el primer día del mes empieza el mes ese mismo día", () => {
    const starts = salesPeriodStarts(new Date("2026-12-01T12:00:00Z"));
    expect(starts.month.toISOString()).toBe("2026-12-01T03:00:00.000Z");
    expect(starts.today.toISOString()).toBe("2026-12-01T03:00:00.000Z");
  });
});
