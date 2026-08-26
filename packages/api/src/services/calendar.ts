import { eq } from "drizzle-orm";
import { BUSINESS_TIMEZONE } from "@naty/shared";
import { appointments, customers, db, locations, services } from "../db";
import { ENV } from "../env";

export type CalendarEvent = {
  uid: string;
  startsAt: Date;
  endsAt: Date;
  title: string;
  description?: string;
  location?: string;
  url?: string;
  cancelled?: boolean;
};

/** Formato UTC compacto que exige iCalendar: 20260316T120000Z */
function toIcsStamp(date: Date): string {
  return date.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
}

/** En los campos TEXT hay que escapar barra invertida, coma, punto y coma y salto de línea. */
function escapeText(value: string): string {
  return value
    .replace(/\\/g, "\\\\")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,")
    .replace(/\r?\n/g, "\\n");
}

/**
 * iCalendar limita las líneas a 75 octetos y exige continuarlas con un espacio
 * inicial. Se cuenta en bytes, no en caracteres: los acentos ocupan dos y una
 * descripción en español desborda antes de lo que sugiere su longitud.
 */
function foldLine(line: string): string {
  const bytes = Buffer.from(line, "utf8");
  if (bytes.length <= 75) return line;

  const chunks: string[] = [];
  let current = Buffer.alloc(0);

  for (const char of line) {
    const charBytes = Buffer.from(char, "utf8");
    const limit = chunks.length === 0 ? 75 : 74; // las continuaciones gastan un byte en el espacio
    if (current.length + charBytes.length > limit) {
      chunks.push(current.toString("utf8"));
      current = Buffer.alloc(0);
    }
    current = Buffer.concat([current, charBytes]);
  }
  chunks.push(current.toString("utf8"));

  return chunks.map((chunk, index) => (index === 0 ? chunk : ` ${chunk}`)).join("\r\n");
}

export function buildIcs(event: CalendarEvent): string {
  const now = toIcsStamp(new Date());

  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//naty.studio//Agenda//ES",
    "CALSCALE:GREGORIAN",
    `METHOD:${event.cancelled ? "CANCEL" : "PUBLISH"}`,
    "BEGIN:VEVENT",
    `UID:${event.uid}`,
    `DTSTAMP:${now}`,
    `DTSTART:${toIcsStamp(event.startsAt)}`,
    `DTEND:${toIcsStamp(event.endsAt)}`,
    `SUMMARY:${escapeText(event.title)}`,
    `STATUS:${event.cancelled ? "CANCELLED" : "CONFIRMED"}`,
    `SEQUENCE:${event.cancelled ? 1 : 0}`,
  ];

  if (event.description) lines.push(`DESCRIPTION:${escapeText(event.description)}`);
  if (event.location) lines.push(`LOCATION:${escapeText(event.location)}`);
  if (event.url) lines.push(`URL:${event.url}`);

  if (!event.cancelled) {
    lines.push(
      "BEGIN:VALARM",
      "TRIGGER:-PT24H",
      "ACTION:DISPLAY",
      `DESCRIPTION:${escapeText(`Mañana: ${event.title}`)}`,
      "END:VALARM",
    );
  }

  lines.push("END:VEVENT", "END:VCALENDAR");

  // El estándar exige terminadores CRLF, incluido el de la última línea.
  return `${lines.map(foldLine).join("\r\n")}\r\n`;
}

/** Enlace para añadir el evento a Google Calendar sin descargar el archivo. */
export function buildGoogleCalendarUrl(event: CalendarEvent): string {
  const params = new URLSearchParams({
    action: "TEMPLATE",
    text: event.title,
    dates: `${toIcsStamp(event.startsAt)}/${toIcsStamp(event.endsAt)}`,
    ctz: BUSINESS_TIMEZONE,
  });
  if (event.description) params.set("details", event.description);
  if (event.location) params.set("location", event.location);
  return `https://calendar.google.com/calendar/render?${params.toString()}`;
}

/**
 * Arma el `.ics` de una cita a partir de su `publicId`.
 *
 * Vive aquí (no en la ruta de `apps/web`) para que esa ruta no necesite
 * depender de Drizzle directamente: sólo pide "el ics de esta reserva" y este
 * paquete resuelve la consulta y el formato.
 */
export async function buildIcsForAppointment(publicId: string): Promise<string | null> {
  const rows = await db
    .select({ appointment: appointments, service: services, customer: customers, location: locations })
    .from(appointments)
    .innerJoin(services, eq(appointments.serviceId, services.id))
    .innerJoin(customers, eq(appointments.customerId, customers.id))
    .innerJoin(locations, eq(appointments.locationId, locations.id))
    .where(eq(appointments.publicId, publicId))
    .limit(1);

  const found = rows[0];
  if (!found) return null;

  const locationLine = found.location.streetAddress
    ? `${found.location.streetAddress}, ${found.location.city}`
    : `${found.location.city}, Chile`;

  return buildIcs({
    uid: `${found.appointment.publicId}@naty.studio`,
    startsAt: found.appointment.startsAt,
    endsAt: found.appointment.endsAt,
    title: `${found.service.name} · naty.studio`,
    description: `Tu cita en naty.studio, ${found.location.city}.`,
    location: locationLine,
    url: `${ENV.siteUrl}/reserva/${found.appointment.publicId}`,
    cancelled: found.appointment.status === "cancelled",
  });
}
