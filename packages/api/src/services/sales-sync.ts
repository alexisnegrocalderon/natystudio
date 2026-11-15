import { and, eq, isNull, lte, sql } from "drizzle-orm";
import { db, payments, saleEvents } from "../db";
import { ENV } from "../env";
import { buildSaleEvent, retryDelayMs, signSaleBody, type SaleEventKind } from "./sales-events";

/**
 * Las migraciones de este proyecto se corren a mano. Si el deploy llega antes
 * que la 0009, encolar una venta fallaría; por eso la tabla se asegura acá una
 * vez por proceso (mismo SQL que la migración, que usa IF NOT EXISTS).
 */
let schemaReady: Promise<void> | undefined;
function ensureSchema(): Promise<void> {
  schemaReady ??= (async () => {
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS sale_events (
        id serial PRIMARY KEY,
        payment_id integer NOT NULL REFERENCES payments(id) ON DELETE CASCADE,
        kind varchar(20) NOT NULL,
        payload text NOT NULL,
        attempts integer NOT NULL DEFAULT 0,
        last_error text,
        next_attempt_at timestamptz NOT NULL DEFAULT now(),
        sent_at timestamptz,
        created_at timestamptz NOT NULL DEFAULT now()
      )`);
    await db.execute(sql`CREATE UNIQUE INDEX IF NOT EXISTS sale_events_payment_kind_key ON sale_events (payment_id, kind)`);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS sale_events_pending_idx ON sale_events (sent_at, next_attempt_at)`);
  })().catch(error => {
    schemaReady = undefined;
    throw error;
  });
  return schemaReady;
}

const salesConfigured = () => Boolean(ENV.ancSales.url && ENV.ancSales.sourceKey && ENV.ancSales.secret);

/**
 * Anota una venta para informarla al panel y trata de enviarla enseguida.
 * Nunca lanza: informar al panel no puede romper un pago ya cobrado.
 * "refunded" sólo se encola si ese pago llegó a informarse como pagado.
 */
export async function reportSale(paymentId: number, kind: SaleEventKind): Promise<void> {
  try {
    await ensureSchema();
    const [payment] = await db.select().from(payments).where(eq(payments.id, paymentId)).limit(1);
    if (!payment) return;

    if (kind === "refunded") {
      const [paid] = await db
        .select({ id: saleEvents.id })
        .from(saleEvents)
        .where(and(eq(saleEvents.paymentId, paymentId), eq(saleEvents.kind, "paid")))
        .limit(1);
      if (!paid) return;
    }

    const now = new Date();
    const body = buildSaleEvent(payment, kind, now, kind === "paid" ? now : undefined);
    await db
      .insert(saleEvents)
      .values({ paymentId, kind, payload: JSON.stringify(body) })
      .onConflictDoNothing();

    await flushSaleEvents(5, 4000);
  } catch (error) {
    console.error(`[ventas] no se pudo registrar la venta del pago ${paymentId}:`, error);
  }
}

/** Envía los eventos pendientes cuyo turno ya llegó. Devuelve cuántos salieron bien. */
export async function flushSaleEvents(limit = 20, timeoutMs = 8000): Promise<number> {
  if (!salesConfigured()) return 0;
  await ensureSchema();

  const due = await db
    .select()
    .from(saleEvents)
    .where(and(isNull(saleEvents.sentAt), lte(saleEvents.nextAttemptAt, new Date())))
    .orderBy(saleEvents.id)
    .limit(limit);

  let sent = 0;
  for (const event of due) {
    try {
      const response = await fetch(ENV.ancSales.url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-anc-source": ENV.ancSales.sourceKey,
          "x-anc-signature": signSaleBody(ENV.ancSales.secret, event.payload),
        },
        body: event.payload,
        signal: AbortSignal.timeout(timeoutMs),
      });
      if (!response.ok) throw new Error(`el panel respondió ${response.status}`);
      await db.update(saleEvents).set({ sentAt: new Date(), lastError: null }).where(eq(saleEvents.id, event.id));
      sent += 1;
    } catch (error) {
      const attempts = event.attempts + 1;
      await db
        .update(saleEvents)
        .set({
          attempts,
          lastError: String(error instanceof Error ? error.message : error).slice(0, 300),
          nextAttemptAt: new Date(Date.now() + retryDelayMs(attempts)),
        })
        .where(eq(saleEvents.id, event.id));
      console.error(`[ventas] no se pudo enviar el evento ${event.id} (intento ${attempts}):`, error);
    }
  }
  return sent;
}
