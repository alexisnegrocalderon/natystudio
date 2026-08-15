import { BUSINESS_TIMEZONE } from "./constants";

/** El peso chileno no tiene decimales: los montos viajan y se guardan como enteros. */
export function formatClp(amount: number): string {
  return new Intl.NumberFormat("es-CL", {
    style: "currency",
    currency: "CLP",
    maximumFractionDigits: 0,
  }).format(amount);
}

export function formatDuration(minutes: number): string {
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  if (rest === 0) return hours === 1 ? "1 hora" : `${hours} horas`;
  return `${hours} h ${rest} min`;
}

const dateFormatter = new Intl.DateTimeFormat("es-CL", {
  timeZone: BUSINESS_TIMEZONE,
  weekday: "long",
  day: "numeric",
  month: "long",
});

const timeFormatter = new Intl.DateTimeFormat("es-CL", {
  timeZone: BUSINESS_TIMEZONE,
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
});

/** "martes 4 de marzo" — siempre en hora de Chile, sin importar dónde esté el servidor. */
export function formatBusinessDate(instant: Date): string {
  return dateFormatter.format(instant);
}

/** "15:30" en hora de Chile. */
export function formatBusinessTime(instant: Date): string {
  return timeFormatter.format(instant);
}

export function formatBusinessDateTime(instant: Date): string {
  return `${formatBusinessDate(instant)}, ${formatBusinessTime(instant)} h`;
}

/** Convierte minutos desde medianoche (como los guarda `businessHours`) a "09:30". */
export function minutesToLabel(minutesFromMidnight: number): string {
  const hours = Math.floor(minutesFromMidnight / 60);
  const minutes = minutesFromMidnight % 60;
  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
}

export function labelToMinutes(label: string): number {
  const [hours, minutes] = label.split(":").map(Number);
  return hours * 60 + minutes;
}
