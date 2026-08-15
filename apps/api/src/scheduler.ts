import cron from "node-cron";
import { and, eq, lt } from "drizzle-orm";
import { db, appointments } from "./db";
import { processPendingEmailJobs } from "./services/email";

/** Una reserva que quedó esperando pago no puede retener el horario para siempre. */
const HOLD_TIMEOUT_MS = 15 * 60_000;

async function releaseExpiredHolds(): Promise<number> {
  const cutoff = new Date(Date.now() - HOLD_TIMEOUT_MS);

  const released = await db
    .update(appointments)
    .set({ status: "cancelled", updatedAt: new Date() })
    .where(and(eq(appointments.status, "pending_payment"), lt(appointments.createdAt, cutoff)))
    .returning({ id: appointments.id });

  return released.length;
}

let running = false;

async function tick(): Promise<void> {
  // Una pasada lenta no debe solaparse con la siguiente: procesarían los mismos
  // avisos a la vez.
  if (running) return;
  running = true;

  try {
    const [sent, released] = await Promise.all([processPendingEmailJobs(), releaseExpiredHolds()]);
    if (sent > 0) console.info(`[scheduler] ${sent} aviso(s) enviado(s)`);
    if (released > 0) console.info(`[scheduler] ${released} horario(s) liberado(s)`);
  } catch (error) {
    console.error("[scheduler] error durante la pasada:", error);
  } finally {
    running = false;
  }
}

export function startScheduler(): void {
  // Cada cinco minutos. Es posible porque el API es un proceso permanente; en
  // funciones serverless esto necesitaría un cron externo.
  cron.schedule("*/5 * * * *", tick);
  console.info("[scheduler] activo — revisión cada 5 minutos");
  void tick();
}
