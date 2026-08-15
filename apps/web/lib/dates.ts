import { BUSINESS_TIMEZONE } from "@naty/shared";

const dayFormatter = new Intl.DateTimeFormat("en-CA", {
  timeZone: BUSINESS_TIMEZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

const monthFormatter = new Intl.DateTimeFormat("es-CL", {
  timeZone: BUSINESS_TIMEZONE,
  month: "long",
  year: "numeric",
});

/**
 * Fecha YYYY-MM-DD de un instante, en hora de Chile.
 *
 * Importa usar la zona del negocio y no la del navegador: una clienta que
 * consulta desde España vería el día siguiente si convirtiéramos con su reloj.
 */
export function toBusinessDay(instant: Date): string {
  return dayFormatter.format(instant);
}

/** Hoy en hora de Chile, como YYYY-MM-DD. */
export function businessToday(): string {
  return toBusinessDay(new Date());
}

export function monthLabel(year: number, month: number): string {
  return monthFormatter.format(new Date(Date.UTC(year, month, 15, 12)));
}

export function parseDay(day: string): { year: number; month: number; date: number } {
  const [year, month, date] = day.split("-").map(Number);
  return { year, month, date };
}

export function formatDay(year: number, month: number, date: number): string {
  return `${year}-${String(month).padStart(2, "0")}-${String(date).padStart(2, "0")}`;
}

export function daysInMonth(year: number, month: number): number {
  return new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
}

/** Día de la semana (0 = domingo) del primer día del mes. */
export function firstWeekdayOfMonth(year: number, month: number): number {
  return new Date(Date.UTC(year, month, 1)).getUTCDay();
}

export function addMonths(year: number, month: number, delta: number): { year: number; month: number } {
  const total = year * 12 + month + delta;
  return { year: Math.floor(total / 12), month: ((total % 12) + 12) % 12 };
}

/** Compara fechas YYYY-MM-DD lexicográficamente, que para este formato equivale al orden real. */
export function isBefore(a: string, b: string): boolean {
  return a < b;
}

export function addDaysToDay(day: string, days: number): string {
  const { year, month, date } = parseDay(day);
  const shifted = new Date(Date.UTC(year, month - 1, date + days));
  return formatDay(shifted.getUTCFullYear(), shifted.getUTCMonth() + 1, shifted.getUTCDate());
}

export const WEEKDAY_SHORT = ["Do", "Lu", "Ma", "Mi", "Ju", "Vi", "Sá"] as const;
