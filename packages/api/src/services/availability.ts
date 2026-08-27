import { TZDate } from "@date-fns/tz";
import { BUSINESS_TIMEZONE, minutesToLabel } from "@naty/shared";

export type AvailabilityService = {
  durationMin: number;
  bufferMin: number;
};

export type AvailabilityBusinessHour = {
  weekday: number;
  startMinute: number;
  endMinute: number;
};

/** Cita ya existente que ocupa horario. `blockedUntil` incluye el buffer. */
export type BusyInterval = {
  startsAt: Date;
  blockedUntil: Date;
};

export type TimeOffInterval = {
  startsAt: Date;
  endsAt: Date;
};

/** Excepción puntual: para su `day`, reemplaza por completo la plantilla semanal. */
export type AvailabilityDateOverride = {
  day: string;
  startMinute: number;
  endMinute: number;
};

export type AvailabilitySettings = {
  slotGranularityMin: number;
  minLeadTimeHours: number;
  maxAdvanceDays: number;
};

export type ComputeSlotsInput = {
  /** Primer día del rango, YYYY-MM-DD en hora de Chile. */
  from: string;
  /** Último día del rango, inclusive. */
  to: string;
  service: AvailabilityService;
  businessHours: AvailabilityBusinessHour[];
  /** Si trae filas para un día, esas reemplazan la plantilla semanal ese día. */
  dateOverrides?: AvailabilityDateOverride[];
  appointments: BusyInterval[];
  timeOff: TimeOffInterval[];
  settings: AvailabilitySettings;
  now: Date;
  timeZone?: string;
};

export type Slot = {
  /** Instante absoluto de inicio. Es lo que después se guarda en la cita. */
  startsAt: Date;
  /** Etiqueta en hora de Chile, lista para mostrar ("09:30"). */
  label: string;
};

export type DayAvailability = {
  /** YYYY-MM-DD en hora de Chile. */
  date: string;
  slots: Slot[];
};

const MINUTE_MS = 60_000;
const DAY_MS = 86_400_000;

function parseDay(day: string): { year: number; month: number; date: number } {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(day);
  if (!match) throw new Error(`Fecha inválida: "${day}". Se espera YYYY-MM-DD.`);
  return { year: Number(match[1]), month: Number(match[2]), date: Number(match[3]) };
}

function formatDay(year: number, month: number, date: number): string {
  return `${year}-${String(month).padStart(2, "0")}-${String(date).padStart(2, "0")}`;
}

/**
 * Convierte una hora de pared local (día + minutos desde medianoche) al instante
 * absoluto correspondiente.
 *
 * Devuelve `null` cuando esa hora local **no existe**, que es justo lo que pasa
 * en el adelanto de horario chileno: en septiembre los relojes saltan y la hora
 * siguiente a medianoche simplemente no ocurre. Sin esta comprobación, esos
 * huecos se ofrecerían como horarios reservables y la cita terminaría en un
 * instante distinto al que vio la clienta.
 */
export function wallTimeToInstant(
  day: string,
  minutesFromMidnight: number,
  timeZone: string,
): Date | null {
  const { year, month, date } = parseDay(day);
  const hours = Math.floor(minutesFromMidnight / 60);
  const minutes = minutesFromMidnight % 60;

  const zoned = new TZDate(year, month - 1, date, hours, minutes, 0, 0, timeZone);
  const instant = new Date(zoned.getTime());
  if (Number.isNaN(instant.getTime())) return null;

  // Si al releer el instante en la misma zona no obtenemos la hora que pedimos,
  // esa hora de pared no existe (salto de horario de verano).
  const roundTrip = new TZDate(instant, timeZone);
  if (roundTrip.getHours() !== hours || roundTrip.getMinutes() !== minutes) return null;

  return instant;
}

/** Lista de días YYYY-MM-DD entre `from` y `to`, ambos inclusive. */
export function eachDayInRange(from: string, to: string): string[] {
  const start = parseDay(from);
  const end = parseDay(to);
  const startUtc = Date.UTC(start.year, start.month - 1, start.date);
  const endUtc = Date.UTC(end.year, end.month - 1, end.date);
  if (endUtc < startUtc) return [];

  const days: string[] = [];
  for (let cursor = startUtc; cursor <= endUtc; cursor += DAY_MS) {
    const day = new Date(cursor);
    days.push(formatDay(day.getUTCFullYear(), day.getUTCMonth() + 1, day.getUTCDate()));
  }
  return days;
}

/** Día de la semana (0 = domingo) de una fecha, en la zona del negocio. */
export function weekdayOf(day: string, timeZone: string): number {
  const { year, month, date } = parseDay(day);
  // Mediodía: cualquier salto de horario ocurre de madrugada, así que a esta
  // hora la fecha local nunca es ambigua.
  return new TZDate(year, month - 1, date, 12, 0, 0, 0, timeZone).getDay();
}

function overlaps(aStart: number, aEnd: number, bStart: number, bEnd: number): boolean {
  return aStart < bEnd && bStart < aEnd;
}

/**
 * Calcula los horarios reservables de un servicio en un rango de días.
 *
 * Función pura: no toca la base de datos ni el reloj del sistema (`now` entra
 * como parámetro), de modo que los casos borde —cambios de horario incluidos—
 * se pueden verificar con tests deterministas.
 */
export function computeSlots(input: ComputeSlotsInput): DayAvailability[] {
  const timeZone = input.timeZone ?? BUSINESS_TIMEZONE;
  const { service, settings, now } = input;

  const durationMs = service.durationMin * MINUTE_MS;
  const blockMs = (service.durationMin + service.bufferMin) * MINUTE_MS;
  const earliest = now.getTime() + settings.minLeadTimeHours * 60 * MINUTE_MS;
  const latest = now.getTime() + settings.maxAdvanceDays * DAY_MS;
  const granularity = Math.max(5, settings.slotGranularityMin);

  const hoursByWeekday = new Map<number, AvailabilityBusinessHour[]>();
  for (const entry of input.businessHours) {
    const list = hoursByWeekday.get(entry.weekday) ?? [];
    list.push(entry);
    hoursByWeekday.set(entry.weekday, list);
  }

  const overridesByDay = new Map<string, { startMinute: number; endMinute: number }[]>();
  for (const entry of input.dateOverrides ?? []) {
    const list = overridesByDay.get(entry.day) ?? [];
    list.push({ startMinute: entry.startMinute, endMinute: entry.endMinute });
    overridesByDay.set(entry.day, list);
  }

  const busy = input.appointments.map(item => ({
    start: item.startsAt.getTime(),
    end: item.blockedUntil.getTime(),
  }));
  const blocks = input.timeOff.map(item => ({
    start: item.startsAt.getTime(),
    end: item.endsAt.getTime(),
  }));

  return eachDayInRange(input.from, input.to).map(day => {
    // Una excepción para esta fecha reemplaza la plantilla semanal por
    // completo (no se combinan) — si no hay excepción, se cae al patrón
    // recurrente de siempre.
    const windows = overridesByDay.get(day) ?? hoursByWeekday.get(weekdayOf(day, timeZone)) ?? [];
    const slots: Slot[] = [];

    for (const window of windows) {
      for (
        let minute = window.startMinute;
        // La cita debe caber completa dentro del horario comercial. El buffer de
        // limpieza sí puede extenderse más allá del cierre: bloquea la agenda,
        // pero no es tiempo de atención.
        minute + service.durationMin <= window.endMinute;
        minute += granularity
      ) {
        const startsAt = wallTimeToInstant(day, minute, timeZone);
        if (!startsAt) continue;

        const start = startsAt.getTime();
        if (start < earliest || start > latest) continue;

        const blockedUntil = start + blockMs;
        if (busy.some(item => overlaps(start, blockedUntil, item.start, item.end))) continue;

        // Frente a un bloqueo de agenda sólo importa la atención en sí: que la
        // limpieza posterior caiga dentro de un bloqueo no molesta a nadie.
        if (blocks.some(item => overlaps(start, start + durationMs, item.start, item.end))) continue;

        slots.push({ startsAt, label: minutesToLabel(minute) });
      }
    }

    slots.sort((a, b) => a.startsAt.getTime() - b.startsAt.getTime());
    return { date: day, slots };
  });
}
