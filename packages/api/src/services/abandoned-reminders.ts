import { and, desc, eq, gte, inArray, isNull, lte, sql } from "drizzle-orm";
import { db, leadReminders, leads, reminderSettings, services } from "../db";
import { ENV } from "../env";
import { enqueueManualMessage } from "./email";

/**
 * Recordatorio a quien dejó una reserva o un servicio sin terminar. Las dos tablas que usa se crean acá la
 * primera vez (mismo SQL que la migración 0010, con IF NOT EXISTS) para que desplegar antes de correr la
 * migración no rompa nada.
 */
let schemaReady: Promise<void> | undefined;
export function ensureReminderSchema(): Promise<void> {
  schemaReady ??= (async () => {
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS reminder_settings (
        id integer PRIMARY KEY DEFAULT 1,
        abandoned_enabled boolean NOT NULL DEFAULT true,
        abandoned_delay_hours integer NOT NULL DEFAULT 24,
        updated_at timestamptz NOT NULL DEFAULT now()
      )`);
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS lead_reminders (
        lead_id integer PRIMARY KEY REFERENCES leads(id) ON DELETE CASCADE,
        sent_at timestamptz NOT NULL DEFAULT now()
      )`);
  })().catch(error => {
    schemaReady = undefined;
    throw error;
  });
  return schemaReady;
}

export const DEFAULT_REMINDER_SETTINGS = { abandonedEnabled: true, abandonedDelayHours: 24 };

export async function getReminderSettings(): Promise<{ abandonedEnabled: boolean; abandonedDelayHours: number }> {
  await ensureReminderSchema();
  const [row] = await db.select().from(reminderSettings).where(eq(reminderSettings.id, 1)).limit(1);
  return row
    ? { abandonedEnabled: row.abandonedEnabled, abandonedDelayHours: row.abandonedDelayHours }
    : DEFAULT_REMINDER_SETTINGS;
}

export async function saveReminderSettings(input: { abandonedEnabled: boolean; abandonedDelayHours: number }) {
  await ensureReminderSchema();
  await db
    .insert(reminderSettings)
    .values({ id: 1, ...input })
    .onConflictDoUpdate({ target: reminderSettings.id, set: { ...input, updatedAt: new Date() } });
  return input;
}

/** Los recordatorios sólo salen en horario de día, hora de Chile: nadie quiere un correo a las 3 de la mañana. */
const SEND_FROM_HOUR = 9;
const SEND_UNTIL_HOUR = 20;
/** Pasado este tiempo desde que dejó la reserva, el recordatorio ya no tiene sentido y no se manda. */
const MAX_AGE_AFTER_DELAY_MS = 48 * 3_600_000;
/** A una misma persona no se le escribe dos veces en este plazo, aunque haya dejado varios servicios. */
const SAME_PERSON_COOLDOWN_MS = 7 * 86_400_000;
const BATCH_SIZE = 20;

export function santiagoHour(date: Date): number {
  return Number(
    new Intl.DateTimeFormat("en-GB", { hour: "2-digit", hour12: false, timeZone: "America/Santiago" }).format(date),
  ) % 24;
}

export function isSendingHour(date: Date): boolean {
  const hour = santiagoHour(date);
  return hour >= SEND_FROM_HOUR && hour < SEND_UNTIL_HOUR;
}

export type ReminderCopy = { subject: string; body: string; cta: { label: string; url: string } };

/** El texto del correo. Pura, para poder probarla sin base de datos. */
export function buildReminderCopy(input: {
  name: string | null;
  serviceName: string | null;
  serviceSlug: string | null;
  serviceKind: "service" | "course" | null;
  siteUrl: string;
}): ReminderCopy {
  const first = input.name?.trim().split(/\s+/)[0] || "";
  const hello = first ? `Hola ${first}` : "Hola";
  const isCourse = input.serviceKind === "course";

  const what = input.serviceName
    ? isCourse
      ? `el curso ${input.serviceName}`
      : `tu hora para ${input.serviceName}`
    : "tu reserva";

  const url = !input.serviceSlug
    ? `${input.siteUrl}/reservar`
    : isCourse
      ? `${input.siteUrl}/curso`
      : `${input.siteUrl}/reservar?servicios=${encodeURIComponent(input.serviceSlug)}`;

  return {
    subject: input.serviceName ? `${first ? `${first}, ` : ""}${input.serviceName} te está esperando` : "Tu reserva quedó a medias",
    body: [
      `${hello}, ayer empezaste a reservar y dejaste ${what} en espera.`,
      isCourse
        ? "Si todavía te interesa, puedes retomarlo desde el enlace."
        : "Si todavía te interesa, puedes retomarla en un par de minutos desde el enlace: los horarios se llenan y no queremos que pierdas el tuyo.",
      "Si tienes dudas, responde este correo y te ayudamos. Es el único recordatorio que te enviaremos.",
    ].join("\n\n"),
    cta: { label: isCourse ? "Ver el curso" : "Retomar mi reserva", url },
  };
}

/**
 * Manda el recordatorio a quienes dejaron algo sin terminar hace `abandonedDelayHours` (y no más de 48 h
 * después de eso). Cada contacto recibe como máximo uno: la fila de `lead_reminders` se reclama antes de
 * encolar el correo, así dos pasadas simultáneas del cron no lo duplican.
 */
export async function sendAbandonedReminders(now = new Date()): Promise<number> {
  const settings = await getReminderSettings();
  if (!settings.abandonedEnabled || !isSendingHour(now)) return 0;

  const delayMs = settings.abandonedDelayHours * 3_600_000;
  const newest = new Date(now.getTime() - delayMs);
  const oldest = new Date(now.getTime() - delayMs - MAX_AGE_AFTER_DELAY_MS);

  const candidates = await db
    .select({
      id: leads.id,
      email: leads.email,
      name: leads.name,
      serviceName: services.name,
      serviceSlug: services.slug,
      serviceKind: services.kind,
    })
    .from(leads)
    .leftJoin(services, eq(leads.serviceId, services.id))
    .leftJoin(leadReminders, eq(leadReminders.leadId, leads.id))
    .where(
      and(
        isNull(leads.convertedAt),
        isNull(leadReminders.leadId),
        lte(leads.createdAt, newest),
        gte(leads.createdAt, oldest),
        sql`${leads.email} LIKE '%@%'`,
        // Si después de dejar la reserva esta persona tiene una cita viva (confirmada, por aprobar o con pago
        // en curso), ya no está "a medias". Una espera de pago vencida queda cancelada y sí cuenta como abandono.
        sql`NOT EXISTS (
          SELECT 1 FROM appointments a JOIN customers c ON c.id = a.customer_id
          WHERE lower(c.email) = lower(${leads.email})
            AND a.status <> 'cancelled'
            AND a.created_at >= ${leads.createdAt}
        )`,
      ),
    )
    // Con varios registros de la misma persona gana el que sí tiene un servicio: el correo dice qué dejó pendiente.
    .orderBy(sql`(${leads.serviceId} IS NULL)`, desc(leads.createdAt))
    .limit(BATCH_SIZE * 3);

  if (candidates.length === 0) return 0;

  // A la misma persona (mismo correo) una sola vez por pasada y no más de una por semana.
  const emails = [...new Set(candidates.map(candidate => candidate.email.toLowerCase()))];
  const recentlyReminded = await db
    .select({ email: leads.email })
    .from(leadReminders)
    .innerJoin(leads, eq(leads.id, leadReminders.leadId))
    .where(
      and(
        gte(leadReminders.sentAt, new Date(now.getTime() - SAME_PERSON_COOLDOWN_MS)),
        inArray(sql`lower(${leads.email})`, emails),
      ),
    );
  const skip = new Set(recentlyReminded.map(row => row.email.toLowerCase()));

  let sent = 0;
  for (const candidate of candidates) {
    if (sent >= BATCH_SIZE) break;
    const key = candidate.email.toLowerCase();
    if (skip.has(key)) continue;

    const claimed = await db
      .insert(leadReminders)
      .values({ leadId: candidate.id })
      .onConflictDoNothing()
      .returning({ leadId: leadReminders.leadId });
    if (claimed.length === 0) continue;
    skip.add(key);

    try {
      const copy = buildReminderCopy({
        name: candidate.name,
        serviceName: candidate.serviceName,
        serviceSlug: candidate.serviceSlug,
        serviceKind: candidate.serviceKind,
        siteUrl: ENV.siteUrl,
      });
      await enqueueManualMessage(candidate.email, copy.subject, copy.body, copy.cta);
      sent += 1;
    } catch (error) {
      console.error(`[recordatorios] no se pudo encolar el aviso del contacto ${candidate.id}:`, error);
    }
  }
  return sent;
}
