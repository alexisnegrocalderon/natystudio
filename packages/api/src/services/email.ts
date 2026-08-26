import { and, eq, inArray, lte, sql } from "drizzle-orm";
import { Resend } from "resend";
import type { EmailJobKind } from "@naty/shared";
import { ENV } from "../env";
import { db, appointments, customers, emailJobs, services, type Appointment, type Service } from "../db";
import { buildIcs } from "./calendar";
import { renderEmail, renderManualMessage, type TemplateData } from "./email-templates";

const resend = ENV.resendApiKey ? new Resend(ENV.resendApiKey) : null;

type Attachment = { filename: string; content: string };

async function deliver(
  to: string,
  subject: string,
  html: string,
  text: string,
  attachments: Attachment[] = [],
): Promise<void> {
  if (!resend) {
    // Sin RESEND_API_KEY el correo no se envía, pero tampoco se pierde la traza:
    // el trabajo queda marcado como enviado y el contenido se registra. Es el
    // modo esperado en desarrollo, antes de verificar el dominio.
    console.info(`[email] (sin envío real) → ${to} · ${subject}`);
    return;
  }

  const { error } = await resend.emails.send({
    from: ENV.mailFrom,
    to,
    subject,
    html,
    text,
    attachments: attachments.map(file => ({
      filename: file.filename,
      content: Buffer.from(file.content, "utf8").toString("base64"),
    })),
  });

  if (error) {
    throw new Error(`Resend rechazó el envío: ${error.message}`);
  }
}

function buildTemplateData(
  appointment: Appointment,
  service: Pick<Service, "name" | "durationMin">,
  customerName: string,
): TemplateData {
  return {
    customerName,
    serviceName: service.name,
    startsAt: appointment.startsAt,
    endsAt: appointment.endsAt,
    durationMin: service.durationMin,
    priceClp: appointment.priceClp,
    amountPaidClp: appointment.amountPaidClp,
    publicId: appointment.publicId,
    cancelToken: appointment.cancelToken,
    siteUrl: ENV.siteUrl,
  };
}

/** Programa un aviso. El índice único (cita, tipo) evita duplicarlo. */
async function enqueue(
  appointmentId: number,
  kind: EmailJobKind,
  recipient: string,
  scheduledFor: Date,
): Promise<void> {
  await db
    .insert(emailJobs)
    .values({ appointmentId, kind, recipient, scheduledFor })
    .onConflictDoNothing({ target: [emailJobs.appointmentId, emailJobs.kind] });
}

type ManualMessagePayload = { subject: string; body: string };

/**
 * Correo escrito a mano por Naty (ficha de una clienta, o envío masivo). No
 * nace de una cita, así que no tiene con qué renderizar una plantilla: el
 * asunto y el cuerpo viajan tal cual en `payload`. Sin cita, el índice único
 * (cita, tipo) no aplica —los `NULL` nunca colisionan en Postgres— así que
 * cada llamada encola un correo nuevo.
 */
export async function enqueueManualMessage(recipient: string, subject: string, body: string): Promise<void> {
  const payload: ManualMessagePayload = { subject, body };
  await db.insert(emailJobs).values({
    appointmentId: null,
    kind: "manual_message",
    recipient,
    scheduledFor: new Date(),
    payload: JSON.stringify(payload),
  });
}

/** Avisos que se disparan al crear la reserva. */
export async function enqueueBookingEmails(
  appointment: Appointment,
  service: Service,
  customer: { email: string; name: string },
): Promise<void> {
  const now = new Date();
  const confirmed = appointment.status === "confirmed";

  await enqueue(
    appointment.id,
    confirmed ? "booking_confirmed" : "booking_received",
    customer.email,
    now,
  );

  if (ENV.adminNotifyEmail) {
    await enqueue(appointment.id, "admin_new_booking", ENV.adminNotifyEmail, now);
  }

  if (confirmed) {
    await scheduleReminders(appointment, customer.email);
  }
}

/**
 * Programa los recordatorios de 24 y 2 horas antes. Sólo se encolan los que
 * caen en el futuro: una cita reservada para dentro de una hora no debe recibir
 * el aviso de "mañana".
 */
export async function scheduleReminders(appointment: Appointment, recipient: string): Promise<void> {
  const now = Date.now();
  const start = appointment.startsAt.getTime();

  const reminders: Array<{ kind: EmailJobKind; at: number }> = [
    { kind: "reminder_24h", at: start - 24 * 3_600_000 },
    { kind: "reminder_2h", at: start - 2 * 3_600_000 },
  ];

  for (const reminder of reminders) {
    if (reminder.at > now) {
      await enqueue(appointment.id, reminder.kind, recipient, new Date(reminder.at));
    }
  }
}

/** Borra los recordatorios pendientes de una cita (al cancelarla o moverla). */
export async function dropPendingReminders(appointmentId: number): Promise<void> {
  await db
    .delete(emailJobs)
    .where(
      and(
        eq(emailJobs.appointmentId, appointmentId),
        eq(emailJobs.status, "pending"),
        sql`${emailJobs.kind} IN ('reminder_24h', 'reminder_2h')`,
      ),
    );
}

export async function enqueueNow(
  appointment: Appointment,
  kind: EmailJobKind,
  recipient: string,
): Promise<void> {
  await enqueue(appointment.id, kind, recipient, new Date());
}

/**
 * Procesa los avisos vencidos. La idempotencia vive en la fila de la base, no en
 * memoria: reiniciar el proceso no duplica ni pierde recordatorios.
 *
 * Los correos manuales no tienen cita (appointmentId es nulo), así que la
 * carga de contexto va separada: primero se traen los avisos vencidos tal
 * cual, y sólo para los que sí tienen cita se resuelve el resto de la fila.
 */
export async function processPendingEmailJobs(limit = 25): Promise<number> {
  const dueJobs = await db
    .select()
    .from(emailJobs)
    .where(and(eq(emailJobs.status, "pending"), lte(emailJobs.scheduledFor, new Date())))
    .limit(limit);

  if (dueJobs.length === 0) return 0;

  const appointmentIds = [...new Set(dueJobs.map(job => job.appointmentId).filter((id): id is number => id !== null))];

  const appointmentRows = appointmentIds.length
    ? await db
        .select({ appointment: appointments, service: services, customer: customers })
        .from(appointments)
        .innerJoin(services, eq(appointments.serviceId, services.id))
        .innerJoin(customers, eq(appointments.customerId, customers.id))
        .where(inArray(appointments.id, appointmentIds))
    : [];
  const byAppointmentId = new Map(appointmentRows.map(row => [row.appointment.id, row]));

  let sent = 0;

  for (const job of dueJobs) {
    let rendered: { subject: string; html: string; text: string };
    let attachments: Attachment[] = [];

    if (job.kind === "manual_message") {
      const payload = job.payload ? (JSON.parse(job.payload) as { subject: string; body: string }) : null;
      if (!payload) {
        await db
          .update(emailJobs)
          .set({ status: "failed", attempts: job.attempts + 1, lastError: "Sin contenido" })
          .where(eq(emailJobs.id, job.id));
        continue;
      }
      rendered = renderManualMessage(payload.subject, payload.body);
    } else {
      const found = job.appointmentId !== null ? byAppointmentId.get(job.appointmentId) : undefined;
      if (!found) {
        // La cita ya no existe (borrada, o el aviso quedó huérfano): no hay
        // con qué renderizarlo. Se marca fallido para no reintentarlo en vano.
        await db
          .update(emailJobs)
          .set({ status: "failed", attempts: job.attempts + 1, lastError: "La cita ya no existe" })
          .where(eq(emailJobs.id, job.id));
        continue;
      }

      const data = buildTemplateData(found.appointment, found.service, found.customer.name);
      rendered = renderEmail(job.kind, data);

      // Sólo la confirmación lleva el archivo de calendario: es el único
      // momento en que la cita pasa a ser un compromiso firme.
      if (job.kind === "booking_confirmed") {
        attachments = [
          {
            filename: "cita-naty-studio.ics",
            content: buildIcs({
              uid: `${found.appointment.publicId}@naty.studio`,
              startsAt: found.appointment.startsAt,
              endsAt: found.appointment.endsAt,
              title: `${found.service.name} · naty.studio`,
              description: "Tu cita en naty.studio, Valparaíso.",
              location: "Valparaíso, Chile",
              url: `${ENV.siteUrl}/reserva/${found.appointment.publicId}`,
            }),
          },
        ];
      }
    }

    try {
      await deliver(job.recipient, rendered.subject, rendered.html, rendered.text, attachments);
      await db
        .update(emailJobs)
        .set({ status: "sent", sentAt: new Date(), attempts: job.attempts + 1 })
        .where(eq(emailJobs.id, job.id));
      sent += 1;
    } catch (error) {
      const attempts = job.attempts + 1;
      const message = error instanceof Error ? error.message : String(error);
      console.error(`[email] falló el aviso ${job.id} (intento ${attempts}):`, message);

      await db
        .update(emailJobs)
        .set({
          // Tras cinco intentos se deja de reintentar para no acumular envíos
          // fallidos indefinidamente; queda registrado el último error.
          status: attempts >= 5 ? "failed" : "pending",
          attempts,
          lastError: message,
        })
        .where(eq(emailJobs.id, job.id));
    }
  }

  return sent;
}
