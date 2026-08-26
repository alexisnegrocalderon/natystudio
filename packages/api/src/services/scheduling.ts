import { and, eq, gte, inArray, lte, or } from "drizzle-orm";
import { BLOCKING_APPOINTMENT_STATUSES } from "@naty/shared";
import { db, appointments, businessHours, schedulingSettings, services, timeOff } from "../db";
import { computeSlots, eachDayInRange, type DayAvailability } from "./availability";

const DAY_MS = 86_400_000;

/** Valores por defecto si aún no se ha guardado la configuración de la agenda. */
const DEFAULT_SETTINGS = {
  slotGranularityMin: 30,
  minLeadTimeHours: 12,
  maxAdvanceDays: 60,
  autoApprove: false,
};

export async function getSettings() {
  const rows = await db.select().from(schedulingSettings).where(eq(schedulingSettings.id, 1)).limit(1);
  const row = rows[0];
  if (!row) return DEFAULT_SETTINGS;
  return {
    slotGranularityMin: row.slotGranularityMin,
    minLeadTimeHours: row.minLeadTimeHours,
    maxAdvanceDays: row.maxAdvanceDays,
    autoApprove: row.autoApprove,
  };
}

/**
 * Rango absoluto que cubre con holgura los días consultados.
 *
 * Se ensancha un día a cada lado a propósito: los límites del día son horas
 * locales chilenas y el offset cambia dos veces al año, así que un rango
 * calculado al milímetro dejaría fuera citas de los bordes.
 */
function boundsFor(from: string, to: string): { start: Date; end: Date } {
  const days = eachDayInRange(from, to);
  const first = days[0] ?? from;
  const last = days[days.length - 1] ?? to;
  return {
    start: new Date(new Date(`${first}T00:00:00Z`).getTime() - DAY_MS),
    end: new Date(new Date(`${last}T00:00:00Z`).getTime() + 2 * DAY_MS),
  };
}

export async function loadScheduleContext(locationId: number, from: string, to: string) {
  const { start, end } = boundsFor(from, to);

  const [hours, settings, busy, blocks] = await Promise.all([
    db.select().from(businessHours).where(eq(businessHours.locationId, locationId)),
    getSettings(),
    // Global entre sedes a propósito: una sola persona no puede tener dos
    // citas al mismo tiempo aunque sean en direcciones distintas.
    db
      .select({
        startsAt: appointments.startsAt,
        blockedUntil: appointments.blockedUntil,
      })
      .from(appointments)
      .where(
        and(
          inArray(appointments.status, [...BLOCKING_APPOINTMENT_STATUSES]),
          lte(appointments.startsAt, end),
          gte(appointments.blockedUntil, start),
        ),
      ),
    db
      .select({ startsAt: timeOff.startsAt, endsAt: timeOff.endsAt })
      .from(timeOff)
      .where(
        and(
          eq(timeOff.locationId, locationId),
          lte(timeOff.startsAt, end),
          gte(timeOff.endsAt, start),
        ),
      ),
  ]);

  return { hours, settings, busy, blocks };
}

export async function getAvailability(
  serviceId: number,
  locationId: number,
  from: string,
  to: string,
  now = new Date(),
): Promise<DayAvailability[]> {
  const found = await db.select().from(services).where(eq(services.id, serviceId)).limit(1);
  const service = found[0];
  if (!service || !service.active) return [];

  const { hours, settings, busy, blocks } = await loadScheduleContext(locationId, from, to);

  return computeSlots({
    from,
    to,
    service: { durationMin: service.durationMin, bufferMin: service.bufferMin },
    businessHours: hours,
    appointments: busy,
    timeOff: blocks,
    settings,
    now,
  });
}

/**
 * Comprueba que un instante concreto siga siendo reservable.
 *
 * Es la verificación previa a insertar. No sustituye al constraint de exclusión
 * de la base —entre esta consulta y el INSERT alguien puede tomar la hora—, pero
 * permite responder con un mensaje claro en el caso normal en vez de dejar que
 * aflore un error de PostgreSQL.
 */
export async function isSlotAvailable(
  serviceId: number,
  locationId: number,
  startsAt: Date,
  now = new Date(),
): Promise<boolean> {
  const day = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Santiago",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(startsAt);

  const [availability] = await getAvailability(serviceId, locationId, day, day, now);
  return (availability?.slots ?? []).some(slot => slot.startsAt.getTime() === startsAt.getTime());
}
