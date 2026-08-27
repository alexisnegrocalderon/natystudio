import { describe, expect, it } from "vitest";
import { computeSlots, eachDayInRange, wallTimeToInstant, weekdayOf } from "./availability";

const TZ = "America/Santiago";

/** Servicio de referencia: una hora de atención más 15 minutos de limpieza. */
const service = { durationMin: 60, bufferMin: 15 };

const settings = {
  slotGranularityMin: 30,
  minLeadTimeHours: 0,
  maxAdvanceDays: 365,
};

/** 2026-03-16 es un lunes; el 21 un sábado. */
const MONDAY = "2026-03-16";
const SATURDAY = "2026-03-21";

/** Horario comercial de lunes a viernes, 09:00 a 13:00. */
const weekdayHours = [1, 2, 3, 4, 5].map(weekday => ({
  weekday,
  startMinute: 9 * 60,
  endMinute: 13 * 60,
}));

function labelsFor(overrides: Partial<Parameters<typeof computeSlots>[0]> = {}) {
  const [day] = computeSlots({
    from: MONDAY,
    to: MONDAY,
    service,
    businessHours: weekdayHours,
    appointments: [],
    timeOff: [],
    settings,
    now: new Date("2026-03-01T12:00:00Z"),
    timeZone: TZ,
    ...overrides,
  });
  return day.slots.map(slot => slot.label);
}

describe("utilidades de fecha", () => {
  it("enumera el rango de días de forma inclusiva", () => {
    expect(eachDayInRange("2026-03-16", "2026-03-19")).toEqual([
      "2026-03-16",
      "2026-03-17",
      "2026-03-18",
      "2026-03-19",
    ]);
  });

  it("devuelve una lista vacía cuando el rango está invertido", () => {
    expect(eachDayInRange("2026-03-19", "2026-03-16")).toEqual([]);
  });

  it("reconoce el día de la semana en hora de Chile", () => {
    expect(weekdayOf(MONDAY, TZ)).toBe(1);
    expect(weekdayOf(SATURDAY, TZ)).toBe(6);
  });
});

describe("generación de horarios", () => {
  it("ofrece horarios según la granularidad configurada", () => {
    expect(labelsFor()).toEqual(["09:00", "09:30", "10:00", "10:30", "11:00", "11:30", "12:00"]);
  });

  it("no ofrece un horario si la atención no cabe antes del cierre", () => {
    // 12:30 + 60 min terminaría a las 13:30, pasado el cierre de las 13:00.
    expect(labelsFor()).not.toContain("12:30");
  });

  it("permite que el buffer de limpieza se extienda más allá del cierre", () => {
    // 12:00 + 60 min de atención cierra justo a las 13:00; los 15 minutos de
    // limpieza se pasan del horario, y eso es correcto: bloquean agenda pero no
    // son tiempo de atención.
    expect(labelsFor()).toContain("12:00");
  });

  it("no devuelve horarios en un día sin horario comercial", () => {
    const [saturday] = computeSlots({
      from: SATURDAY,
      to: SATURDAY,
      service,
      businessHours: weekdayHours,
      appointments: [],
      timeOff: [],
      settings,
      now: new Date("2026-03-01T12:00:00Z"),
      timeZone: TZ,
    });
    expect(saturday.slots).toEqual([]);
  });
});

describe("restricciones de tiempo", () => {
  it("descarta los horarios que no cumplen la antelación mínima", () => {
    // 2026-03-16 09:00 en Chile (GMT-3) es 12:00Z. Con "ahora" a las 09:00Z y
    // 24 horas de antelación, el lunes entero queda fuera.
    const labels = labelsFor({
      now: new Date("2026-03-16T09:00:00Z"),
      settings: { ...settings, minLeadTimeHours: 24 },
    });
    expect(labels).toEqual([]);
  });

  it("descarta los horarios más allá de la ventana máxima de reserva", () => {
    const labels = labelsFor({
      now: new Date("2026-03-01T12:00:00Z"),
      settings: { ...settings, maxAdvanceDays: 3 },
    });
    expect(labels).toEqual([]);
  });
});

describe("solapamientos", () => {
  it("libera un horario que no choca con la cita existente", () => {
    const labels = labelsFor({
      appointments: [
        {
          // 09:00–10:00 con bloqueo hasta 10:15 (hora de Chile, GMT-3).
          startsAt: new Date("2026-03-16T12:00:00Z"),
          blockedUntil: new Date("2026-03-16T13:15:00Z"),
        },
      ],
    });
    expect(labels).not.toContain("09:00");
    expect(labels).toContain("10:30");
  });

  it("bloquea el horario que se cruza con el buffer de la cita anterior", () => {
    const labels = labelsFor({
      appointments: [
        {
          startsAt: new Date("2026-03-16T12:00:00Z"),
          blockedUntil: new Date("2026-03-16T13:15:00Z"),
        },
      ],
    });
    // Las 10:00 caerían dentro de los 15 minutos de limpieza de la cita previa.
    expect(labels).not.toContain("10:00");
  });

  it("descarta los horarios que caen dentro de un bloqueo de agenda", () => {
    const labels = labelsFor({
      timeOff: [
        {
          // Bloqueo de 11:00 a 13:00 hora de Chile.
          startsAt: new Date("2026-03-16T14:00:00Z"),
          endsAt: new Date("2026-03-16T16:00:00Z"),
        },
      ],
    });
    expect(labels).toEqual(["09:00", "09:30", "10:00"]);
  });
});

describe("excepciones por fecha", () => {
  it("una excepción para el día reemplaza por completo la plantilla semanal", () => {
    const labels = labelsFor({
      dateOverrides: [{ day: MONDAY, startMinute: 14 * 60, endMinute: 16 * 60 }],
    });
    // La plantilla semanal (09:00-13:00) queda ignorada del todo ese día.
    expect(labels).toEqual(["14:00", "14:30", "15:00"]);
  });

  it("sin excepción para el día, se usa la plantilla semanal de siempre", () => {
    const labels = labelsFor({
      dateOverrides: [{ day: "2026-03-17", startMinute: 14 * 60, endMinute: 16 * 60 }],
    });
    expect(labels).toEqual(["09:00", "09:30", "10:00", "10:30", "11:00", "11:30", "12:00"]);
  });

  it("una excepción puede abrir horas en un día sin plantilla semanal", () => {
    const [saturday] = computeSlots({
      from: SATURDAY,
      to: SATURDAY,
      service,
      businessHours: weekdayHours,
      dateOverrides: [{ day: SATURDAY, startMinute: 10 * 60, endMinute: 12 * 60 }],
      appointments: [],
      timeOff: [],
      settings,
      now: new Date("2026-03-01T12:00:00Z"),
      timeZone: TZ,
    });
    expect(saturday.slots.map(slot => slot.label)).toEqual(["10:00", "10:30", "11:00"]);
  });

  it("un bloqueo sigue restando horas de las ventanas de una excepción", () => {
    const labels = labelsFor({
      dateOverrides: [{ day: MONDAY, startMinute: 14 * 60, endMinute: 18 * 60 }],
      timeOff: [
        {
          // Bloqueo de 15:00 a 18:00 hora de Chile.
          startsAt: new Date("2026-03-16T18:00:00Z"),
          endsAt: new Date("2026-03-16T21:00:00Z"),
        },
      ],
    });
    expect(labels).toEqual(["14:00"]);
  });
});

/**
 * Chile adelanta y atrasa la hora una vez al año. Estos casos son la razón por
 * la que todo se guarda en UTC: con offsets fijos las citas se correrían una
 * hora en cada cambio.
 */
describe("cambios de horario en Chile", () => {
  it("mantiene la hora local antes y después del fin del horario de verano", () => {
    // El 5 de abril de 2026 Chile pasa de GMT-3 a GMT-4.
    const instantBefore = wallTimeToInstant("2026-04-04", 10 * 60, TZ);
    const instantAfter = wallTimeToInstant("2026-04-05", 10 * 60, TZ);

    expect(instantBefore?.toISOString()).toBe("2026-04-04T13:00:00.000Z");
    expect(instantAfter?.toISOString()).toBe("2026-04-05T14:00:00.000Z");
  });

  it("omite las horas locales que no existen al adelantar el reloj", () => {
    // El 6 de septiembre de 2026 el reloj salta de 00:00 a 01:00: la primera
    // hora del día no ocurre y no puede ofrecerse como horario reservable.
    expect(wallTimeToInstant("2026-09-06", 0, TZ)).toBeNull();
    expect(wallTimeToInstant("2026-09-06", 30, TZ)).toBeNull();
    expect(wallTimeToInstant("2026-09-06", 60, TZ)?.toISOString()).toBe("2026-09-06T04:00:00.000Z");
  });

  it("no ofrece horarios dentro del salto de horario", () => {
    // 6 de septiembre de 2026 es domingo (weekday 0).
    const [day] = computeSlots({
      from: "2026-09-06",
      to: "2026-09-06",
      service,
      businessHours: [{ weekday: 0, startMinute: 0, endMinute: 180 }],
      appointments: [],
      timeOff: [],
      settings,
      now: new Date("2026-08-01T12:00:00Z"),
      timeZone: TZ,
    });

    expect(day.slots.map(slot => slot.label)).toEqual(["01:00", "01:30", "02:00"]);
  });
});
