import { TRPCError } from "@trpc/server";
import { and, eq, isNull, ne } from "drizzle-orm";
import type { AppointmentStatus, PaymentStatus, ProcessPaymentInput } from "@naty/shared";
import { db, appointments, customers, leads, payments, services, type Appointment, type Service } from "../db";
import { enqueuePaymentEmails } from "./email";
import { createMpPayment, mapMpStatus, rejectionMessage, type MpPayment } from "./mercadopago";

/** Una reserva que quedó esperando pago no puede retener el horario para siempre. */
export const HOLD_TIMEOUT_MS = 15 * 60_000;

/**
 * Un pago que Mercado Pago dejó "pending" (transferencia, efectivo, revisión
 * manual) puede tardar horas en resolverse. 24 horas es un límite generoso
 * antes de soltar la hora y avisarle a Mercado Pago que ya no cuenta.
 */
export const STUCK_PAYMENT_TIMEOUT_MS = 24 * 3_600_000;

/** Ninguna cita acumula más de esto en intentos de pago fallidos. */
export const MAX_PAYMENT_ATTEMPTS = 5;

/* ------------------------------------------------------------------ plan --- */

export type PaymentPlan =
  | { required: false }
  | { required: true; fullClp: number; depositClp: number | null };

/**
 * Decide si una reserva pasa por el paso de pago y con qué montos. Con los
 * pagos apagados, o un precio en "Consulta el valor" (0), el flujo de hoy
 * sigue intacto: la cita nace `pending_approval`/`confirmed` según
 * corresponda y no hay nada que cobrar.
 */
export function resolvePaymentPlan(
  service: Pick<Service, "priceClp" | "depositClp">,
  paymentsEnabled: boolean,
): PaymentPlan {
  if (!paymentsEnabled || service.priceClp <= 0) return { required: false };

  const depositClp = service.depositClp > 0 && service.depositClp < service.priceClp ? service.depositClp : null;
  return { required: true, fullClp: service.priceClp, depositClp };
}

/** El monto nunca lo decide el cliente: siempre se relee del servicio en el servidor. */
export function resolveChargeAmount(plan: Extract<PaymentPlan, { required: true }>, kind: "deposit" | "full"): number {
  if (kind === "full") return plan.fullClp;
  if (plan.depositClp === null) {
    throw new TRPCError({ code: "BAD_REQUEST", message: "Este servicio no tiene abono disponible." });
  }
  return plan.depositClp;
}

/* -------------------------------------------------------- estado de citas --- */

/**
 * Único lugar donde un resultado de pago decide el estado de una cita. Un
 * pago aprobado sobre un hold vigente la confirma; uno aprobado sobre una
 * cita ya cancelada (el hold venció antes de que el banco respondiera) no la
 * resucita —podría estar tomada por otra persona— pero se marca para que
 * alguien revise si corresponde una devolución.
 */
export function nextAppointmentState(
  current: AppointmentStatus,
  mpStatus: PaymentStatus,
): { appointmentStatus: AppointmentStatus; refundNeeded: boolean } {
  if (mpStatus !== "approved") return { appointmentStatus: current, refundNeeded: false };

  if (current === "pending_payment" || current === "pending_approval" || current === "confirmed") {
    return { appointmentStatus: "confirmed", refundNeeded: false };
  }

  return { appointmentStatus: current, refundNeeded: true };
}

/* ------------------------------------------------------------------ hold --- */

export type HoldPayment = { status: PaymentStatus };

/**
 * Cuánto puede seguir vigente un hold sin pagar. Un pago `pending` (revisión,
 * transferencia) protege la hora más allá de los 15 minutos habituales —
 * cobrarle a alguien y perder igual su hora sería peor que la espera— pero no
 * para siempre: pasadas 24 horas se libera y se cancela el pago en Mercado
 * Pago para que no se le cobre por una hora que ya no tiene.
 */
export function shouldReleaseHold(input: {
  createdAt: Date;
  payments: HoldPayment[];
  now: Date;
}): "release" | "keep" | "release-and-cancel-mp" {
  const ageMs = input.now.getTime() - input.createdAt.getTime();
  const hasApproved = input.payments.some(payment => payment.status === "approved");
  if (hasApproved) return "keep";

  const hasPending = input.payments.some(payment => payment.status === "pending");
  if (!hasPending) {
    return ageMs > HOLD_TIMEOUT_MS ? "release" : "keep";
  }

  return ageMs > STUCK_PAYMENT_TIMEOUT_MS ? "release-and-cancel-mp" : "keep";
}

/* --------------------------------------------------------------- resultado --- */

/**
 * Único punto que confirma una cita a partir de un pago. Lo usan tanto la
 * respuesta en línea de `payment.process` como el webhook y el reconciliador
 * del cron, así que tiene que ser segura de ejecutar más de una vez para el
 * mismo pago: si el estado no cambió, no hace nada más.
 */
export async function applyPaymentResult(args: {
  paymentRowId: number;
  mp: MpPayment;
}): Promise<{ appointmentStatus: AppointmentStatus | null; paymentStatus: PaymentStatus; changed: boolean }> {
  const newStatus = mapMpStatus(args.mp.status);
  const rawPayload = JSON.stringify(args.mp).slice(0, 8000);

  const result = await db.transaction(async tx => {
    const [updatedPayment] = await tx
      .update(payments)
      .set({ status: newStatus, externalId: String(args.mp.id), rawPayload, updatedAt: new Date() })
      .where(and(eq(payments.id, args.paymentRowId), ne(payments.status, newStatus)))
      .returning();

    if (!updatedPayment) {
      // Ya estaba en este estado: el webhook y la respuesta en línea corrieron
      // a la par, o es un reintento. No hay nada más que hacer.
      const [current] = await tx.select().from(payments).where(eq(payments.id, args.paymentRowId)).limit(1);
      return { changed: false, paymentStatus: current?.status ?? newStatus, appointment: null as Appointment | null };
    }

    const [appointment] = await tx
      .select()
      .from(appointments)
      .where(eq(appointments.id, updatedPayment.appointmentId))
      .limit(1);
    if (!appointment) return { changed: true, paymentStatus: newStatus, appointment: null };

    if (newStatus !== "approved") {
      return { changed: true, paymentStatus: newStatus, appointment };
    }

    const { appointmentStatus, refundNeeded } = nextAppointmentState(appointment.status, newStatus);
    const [updatedAppointment] = await tx
      .update(appointments)
      .set({
        status: appointmentStatus,
        amountPaidClp: appointment.amountPaidClp + updatedPayment.amountClp,
        updatedAt: new Date(),
      })
      .where(eq(appointments.id, appointment.id))
      .returning();

    if (refundNeeded) {
      console.warn(
        `[payments] pago ${updatedPayment.id} aprobado sobre una cita ${appointment.status}; revisar devolución.`,
      );
    }

    return { changed: true, paymentStatus: newStatus, appointment: updatedAppointment };
  });

  if (result.changed && result.paymentStatus === "approved" && result.appointment) {
    const appointment = result.appointment;
    const [customer] = await db.select().from(customers).where(eq(customers.id, appointment.customerId)).limit(1);
    if (customer) {
      await enqueuePaymentEmails(appointment, customer.email);

      // El pago es lo que cierra el embudo cuando la reserva pasó por un hold:
      // hasta ahora el lead seguía "sin convertir" por si el pago no llegaba.
      await db
        .update(leads)
        .set({ convertedAt: new Date() })
        .where(and(eq(leads.email, customer.email), isNull(leads.convertedAt)));
    }
  }

  return {
    appointmentStatus: result.appointment?.status ?? null,
    paymentStatus: result.paymentStatus,
    changed: result.changed,
  };
}

/* ------------------------------------------------------------------ cobro --- */

const SLOT_NO_LONGER_HELD = new TRPCError({
  code: "CONFLICT",
  message: "Esta reserva ya no está esperando pago. Vuelve a intentar desde el inicio.",
});

export type ProcessPaymentResult = {
  outcome: "approved" | "in_process" | "rejected";
  message: string;
  appointmentStatus: AppointmentStatus;
  amountPaidClp: number;
  remainingClp: number;
};

/**
 * Cobra el abono o el total de una reserva en espera de pago. Autorizado por
 * el `cancelToken` que el cliente ya recibió al reservar, no por el
 * `publicId` (adivinable): así nadie puede pagar la reserva de otra persona.
 */
export async function processPayment(input: ProcessPaymentInput): Promise<ProcessPaymentResult> {
  const [appointment] = await db
    .select()
    .from(appointments)
    .where(eq(appointments.publicId, input.publicId))
    .limit(1);

  if (!appointment || appointment.cancelToken !== input.cancelToken) {
    throw new TRPCError({ code: "FORBIDDEN", message: "El enlace de la reserva no es válido." });
  }
  if (appointment.status !== "pending_payment") {
    throw SLOT_NO_LONGER_HELD;
  }

  const [service] = await db.select().from(services).where(eq(services.id, appointment.serviceId)).limit(1);
  if (!service) throw new TRPCError({ code: "NOT_FOUND", message: "El servicio de la reserva ya no existe." });

  const plan = resolvePaymentPlan(service, true);
  if (!plan.required) {
    throw new TRPCError({ code: "BAD_REQUEST", message: "Esta reserva no requiere pago en línea." });
  }
  const amountClp = resolveChargeAmount(plan, input.kind);

  const priorAttempts = await db
    .select({ id: payments.id })
    .from(payments)
    .where(eq(payments.appointmentId, appointment.id));
  if (priorAttempts.length >= MAX_PAYMENT_ATTEMPTS) {
    throw new TRPCError({
      code: "TOO_MANY_REQUESTS",
      message: "Ya intentaste pagar varias veces esta reserva. Escríbenos por WhatsApp para ayudarte.",
    });
  }

  const [paymentRow] = await db
    .insert(payments)
    .values({ appointmentId: appointment.id, kind: input.kind, status: "pending", amountClp })
    .returning();

  let mpPayment: MpPayment;
  try {
    mpPayment = await createMpPayment({
      amountClp,
      token: input.formData.token,
      paymentMethodId: input.formData.payment_method_id,
      issuerId: input.formData.issuer_id,
      installments: input.formData.installments,
      payerEmail: input.formData.payer.email,
      payerIdentification: input.formData.payer.identification,
      description: `${service.name} · naty.studio`,
      externalReference: appointment.publicId,
      metadata: { appointment_id: appointment.id, payment_row_id: paymentRow.id },
      idempotencyKey: `${appointment.publicId}:${paymentRow.id}`,
    });
  } catch (error) {
    // El cobro no llegó a Mercado Pago: la fila queda "pending" y la persona
    // puede reintentar sin haber gastado uno de sus intentos en vano.
    await db.delete(payments).where(eq(payments.id, paymentRow.id));
    throw error;
  }

  const applied = await applyPaymentResult({ paymentRowId: paymentRow.id, mp: mpPayment });

  if (applied.paymentStatus === "approved") {
    const [refreshed] = await db.select().from(appointments).where(eq(appointments.id, appointment.id)).limit(1);
    return {
      outcome: "approved",
      message: "Pago aprobado. Tu hora quedó confirmada.",
      appointmentStatus: refreshed?.status ?? "confirmed",
      amountPaidClp: refreshed?.amountPaidClp ?? amountClp,
      remainingClp: Math.max(0, service.priceClp - (refreshed?.amountPaidClp ?? amountClp)),
    };
  }

  if (applied.paymentStatus === "rejected") {
    return {
      outcome: "rejected",
      message: rejectionMessage(mpPayment.status_detail),
      appointmentStatus: "pending_payment",
      amountPaidClp: appointment.amountPaidClp,
      remainingClp: service.priceClp - appointment.amountPaidClp,
    };
  }

  return {
    outcome: "in_process",
    message: "Estamos validando tu pago. Te avisaremos apenas se confirme.",
    appointmentStatus: "pending_payment",
    amountPaidClp: appointment.amountPaidClp,
    remainingClp: service.priceClp - appointment.amountPaidClp,
  };
}

/* -------------------------------------------------------------- webhook --- */

/**
 * Ubica a qué fila de `payments` corresponde un pago que llegó por webhook.
 * Primero por `external_id` (el caso normal, una vez que el pago ya se creó
 * del lado de `payment.process`); si no aparece —el webhook puede ganarle la
 * carrera a nuestra propia respuesta de creación— se cae al
 * `payment_row_id` que viaja en los metadatos, validando que el monto y la
 * reserva coincidan antes de confiar en ese id.
 */
export async function findPaymentRowForMpPayment(mp: MpPayment): Promise<number | null> {
  const [byExternalId] = await db
    .select({ id: payments.id })
    .from(payments)
    .where(eq(payments.externalId, String(mp.id)))
    .limit(1);
  if (byExternalId) return byExternalId.id;

  const metadataRowId = mp.metadata?.payment_row_id;
  if (typeof metadataRowId !== "number") return null;

  const [row] = await db.select().from(payments).where(eq(payments.id, metadataRowId)).limit(1);
  if (!row) return null;

  const [appointment] = await db
    .select({ publicId: appointments.publicId })
    .from(appointments)
    .where(eq(appointments.id, row.appointmentId))
    .limit(1);

  const matches =
    appointment?.publicId === mp.external_reference && row.amountClp === Math.round(mp.transaction_amount);

  return matches ? row.id : null;
}
