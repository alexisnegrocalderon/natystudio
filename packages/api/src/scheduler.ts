import { and, eq, lt } from "drizzle-orm";
import { db, appointments, payments } from "./db";
import { processPendingEmailJobs } from "./services/email";
import { cancelMpPayment, getMpPayment } from "./services/mercadopago";
import { applyPaymentResult, HOLD_TIMEOUT_MS, shouldReleaseHold } from "./services/payments";

/**
 * Cancela los holds vencidos y libera su horario. Un hold con un pago
 * `pending` (transferencia, revisión) se protege más allá de los 15 minutos
 * habituales — ver `shouldReleaseHold` — así que se traen todos los
 * candidatos por edad y la decisión fina queda en esa función pura.
 */
export async function releaseExpiredHolds(): Promise<number> {
  const cutoff = new Date(Date.now() - HOLD_TIMEOUT_MS);
  const now = new Date();

  const candidates = await db
    .select()
    .from(appointments)
    .where(and(eq(appointments.status, "pending_payment"), lt(appointments.createdAt, cutoff)));

  let released = 0;

  for (const appointment of candidates) {
    const paymentRows = await db
      .select({ status: payments.status, externalId: payments.externalId })
      .from(payments)
      .where(eq(payments.appointmentId, appointment.id));

    const decision = shouldReleaseHold({ createdAt: appointment.createdAt, payments: paymentRows, now });
    if (decision === "keep") continue;

    await db
      .update(appointments)
      .set({ status: "cancelled", updatedAt: now })
      .where(eq(appointments.id, appointment.id));
    released += 1;

    if (decision === "release-and-cancel-mp") {
      const stuck = paymentRows.find(row => row.status === "pending" && row.externalId);
      if (stuck?.externalId) {
        try {
          await cancelMpPayment(stuck.externalId);
        } catch (error) {
          console.error(`[scheduler] no se pudo cancelar en Mercado Pago el pago ${stuck.externalId}:`, error);
        }
      }
    }
  }

  return released;
}

/**
 * Red de seguridad frente a un webhook perdido o mal firmado: repregunta a
 * Mercado Pago por los pagos que quedaron "pending" sin novedad en un rato y
 * aplica el resultado con la misma función que usa el webhook. Así un aviso
 * que nunca llega es un retraso, no una reserva perdida.
 */
export async function reconcileStalePayments(limit = 25): Promise<number> {
  const cutoff = new Date(Date.now() - 3 * 60_000);

  const stale = await db
    .select({ id: payments.id, externalId: payments.externalId })
    .from(payments)
    .where(and(eq(payments.status, "pending"), lt(payments.updatedAt, cutoff)))
    .limit(limit);

  let reconciled = 0;

  for (const row of stale) {
    // Sin externalId el pago nunca llegó a crearse del lado de Mercado Pago
    // (falló antes de esa respuesta): no hay nada que repreguntar.
    if (!row.externalId) continue;

    try {
      const mp = await getMpPayment(row.externalId);
      const result = await applyPaymentResult({ paymentRowId: row.id, mp });
      if (result.changed) reconciled += 1;
    } catch (error) {
      console.error(`[scheduler] no se pudo reconciliar el pago ${row.id}:`, error);
    }
  }

  return reconciled;
}

let running = false;

/**
 * Una pasada completa del mantenimiento periódico: envía los correos vencidos,
 * libera los holds vencidos y reconcilia pagos atascados. Pensado para
 * dispararse desde una petición HTTP externa (no hay proceso permanente en un
 * entorno serverless), por eso el candado `running` evita que dos disparos
 * simultáneos se pisen.
 */
export async function runMaintenanceTick(): Promise<{ sent: number; released: number; reconciled: number }> {
  if (running) return { sent: 0, released: 0, reconciled: 0 };
  running = true;

  try {
    const [sent, released, reconciled] = await Promise.all([
      processPendingEmailJobs(),
      releaseExpiredHolds(),
      reconcileStalePayments(),
    ]);
    return { sent, released, reconciled };
  } finally {
    running = false;
  }
}
