/**
 * Inicio del día, la semana (lunes) y el mes en hora de Chile, como instantes. Las cifras de ventas del
 * panel se cortan con estos límites: "hoy" para Naty es su día en Santiago, no el día en UTC.
 */
const TZ = "America/Santiago";

function wallClock(date: Date): { y: number; m: number; d: number; hh: number; mm: number; weekday: number } {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    weekday: "short",
    hourCycle: "h23",
  }).formatToParts(date);
  const get = (type: string) => parts.find(part => part.type === type)?.value ?? "";
  const weekdays = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  return {
    y: Number(get("year")),
    m: Number(get("month")),
    d: Number(get("day")),
    hh: Number(get("hour")),
    mm: Number(get("minute")),
    weekday: weekdays.indexOf(get("weekday")),
  };
}

/** Medianoche (hora de Chile) del día y-m-d, como instante. Absorbe el cambio UTC-3 / UTC-4. */
export function chileMidnight(y: number, m: number, d: number): Date {
  const target = Date.UTC(y, m - 1, d, 0, 0);
  let guess = target;
  for (let i = 0; i < 2; i += 1) {
    const shown = wallClock(new Date(guess));
    guess += target - Date.UTC(shown.y, shown.m - 1, shown.d, shown.hh, shown.mm);
  }
  return new Date(guess);
}

export function salesPeriodStarts(now: Date): { today: Date; tomorrow: Date; week: Date; month: Date } {
  const { y, m, d, weekday } = wallClock(now);
  // Lunes como primer día de la semana, como en Chile.
  const sinceMonday = (weekday + 6) % 7;
  const mondayUtc = new Date(Date.UTC(y, m - 1, d - sinceMonday));
  const tomorrowUtc = new Date(Date.UTC(y, m - 1, d + 1));
  return {
    today: chileMidnight(y, m, d),
    tomorrow: chileMidnight(tomorrowUtc.getUTCFullYear(), tomorrowUtc.getUTCMonth() + 1, tomorrowUtc.getUTCDate()),
    week: chileMidnight(mondayUtc.getUTCFullYear(), mondayUtc.getUTCMonth() + 1, mondayUtc.getUTCDate()),
    month: chileMidnight(y, m, 1),
  };
}
