import { and, eq, lt } from "drizzle-orm";
import { db, appointments } from "./db";
import { processPendingEmailJobs } from "./services/email";

/** Una reserva que quedó esperando pago no puede retener el horario para siempre. */
const HOLD_TIMEOUT_MS = 15 * 60_000;

/** Cancela los holds vencidos y libera su horario. Devuelve cuántos se liberaron. */
export async function releaseExpiredHolds(): Promise<number> {
  const cutoff = new Date(Date.now() - HOLD_TIMEOUT_MS);

  const released = await db
    .update(appointments)
    .set({ status: "cancelled", updatedAt: new Date() })
    .where(and(eq(appointments.status, "pending_payment"), lt(appointments.createdAt, cutoff)))
    .returning({ id: appointments.id });

  return released.length;
}

let running = false;

/**
 * Una pasada completa del mantenimiento periódico: envía los correos vencidos
 * y libera los holds vencidos. Pensado para dispararse desde una petición HTTP
 * externa (no hay proceso permanente en un entorno serverless), por eso el
 * candado `running` evita que dos disparos simultáneos se pisen.
 */
export async function runMaintenanceTick(): Promise<{ sent: number; released: number }> {
  if (running) return { sent: 0, released: 0 };
  running = true;

  try {
    const [sent, released] = await Promise.all([processPendingEmailJobs(), releaseExpiredHolds()]);
    return { sent, released };
  } finally {
    running = false;
  }
}
