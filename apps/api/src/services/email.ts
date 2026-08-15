import { and, eq, lte, sql } from "drizzle-orm";
import { Resend } from "resend";
import type { EmailJobKind } from "@naty/shared";
import { ENV } from "../env";
import { db, appointments, customers, emailJobs, services, type Appointment, type Service } from "../db";
import { buildIcs } from "./calendar";
import { renderEmail, type TemplateData } from "./email-templates";

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
 */
export async function processPendingEmailJobs(limit = 25): Promise<number> {
  const pending = await db
    .select({
      job: emailJobs,
      appointment: appointments,
      service: services,
      customer: customers,
    })
    .from(emailJobs)
    .innerJoin(appointments, eq(emailJobs.appointmentId, appointments.id))
    .innerJoin(services, eq(appointments.serviceId, services.id))
    .innerJoin(customers, eq(appointments.customerId, customers.id))
    .where(and(eq(emailJobs.status, "pending"), lte(emailJobs.scheduledFor, new Date())))
    .limit(limit);

  let sent = 0;

  for (const row of pending) {
    const data = buildTemplateData(row.appointment, row.service, row.customer.name);
    const { subject, html, text } = renderEmail(row.job.kind, data);

    // Sólo la confirmación lleva el archivo de calendario: es el único momento
    // en que la cita pasa a ser un compromiso firme.
    const attachments: Attachment[] =
      row.job.kind === "booking_confirmed"
        ? [
            {
              filename: "cita-naty-studio.ics",
              content: buildIcs({
                uid: `${row.appointment.publicId}@naty.studio`,
                startsAt: row.appointment.startsAt,
                endsAt: row.appointment.endsAt,
                title: `${row.service.name} · naty.studio`,
                description: "Tu cita en naty.studio, Valparaíso.",
                location: "Valparaíso, Chile",
                url: `${ENV.siteUrl}/reserva/${row.appointment.publicId}`,
              }),
            },
          ]
        : [];

    try {
      await deliver(row.job.recipient, subject, html, text, attachments);
      await db
        .update(emailJobs)
        .set({ status: "sent", sentAt: new Date(), attempts: row.job.attempts + 1 })
        .where(eq(emailJobs.id, row.job.id));
      sent += 1;
    } catch (error) {
      const attempts = row.job.attempts + 1;
      const message = error instanceof Error ? error.message : String(error);
      console.error(`[email] falló el aviso ${row.job.id} (intento ${attempts}):`, message);

      await db
        .update(emailJobs)
        .set({
          // Tras cinco intentos se deja de reintentar para no acumular envíos
          // fallidos indefinidamente; queda registrado el último error.
          status: attempts >= 5 ? "failed" : "pending",
          attempts,
          lastError: message,
        })
        .where(eq(emailJobs.id, row.job.id));
    }
  }

  return sent;
}
