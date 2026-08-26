import { TRPCError } from "@trpc/server";
import { and, desc, eq, gt, ilike, or, sql, type SQL } from "drizzle-orm";
import { z } from "zod";
import {
  customerBroadcastSchema,
  customerListQuerySchema,
  customerSendEmailSchema,
  customerUpdateSchema,
} from "@naty/shared";
import { db, appointments, customers, payments, services } from "../db";
import { enqueueManualMessage } from "../services/email";
import { adminProcedure, router } from "../trpc";

const idInput = z.object({ id: z.number().int().positive() });

/** Coincide por nombre, correo o teléfono. Vacío = sin filtro. */
function searchCondition(term: string | undefined): SQL | undefined {
  const trimmed = term?.trim();
  if (!trimmed) return undefined;
  return or(
    ilike(customers.name, `%${trimmed}%`),
    ilike(customers.email, `%${trimmed}%`),
    ilike(customers.phone, `%${trimmed}%`),
  );
}

/**
 * Sin paginar, para exportar o para el envío masivo. Un tope generoso evita
 * un problema real (un negocio de este tamaño no tiene miles de clientas)
 * sin necesitar cursor aquí también.
 */
export async function listAllCustomers(search?: string) {
  return db
    .select({ id: customers.id, name: customers.name, email: customers.email, phone: customers.phone })
    .from(customers)
    .where(searchCondition(search))
    .orderBy(customers.name)
    .limit(5000);
}

export const adminCustomersRouter = router({
  /** Listado completo sin paginar, para la vista imprimible. */
  listAll: adminProcedure
    .input(z.object({ search: z.string().trim().max(200).optional() }))
    .query(({ input }) => listAllCustomers(input.search)),

  /** Buscador de clientas con el resumen que se ve en el listado. */
  list: adminProcedure.input(customerListQuerySchema).query(async ({ input }) => {
    const conditions = [searchCondition(input.search), input.cursor ? gt(customers.id, input.cursor) : undefined].filter(
      Boolean,
    );

    const rows = await db
      .select({
        id: customers.id,
        name: customers.name,
        email: customers.email,
        phone: customers.phone,
        createdAt: customers.createdAt,
        appointmentCount: sql<number>`count(${appointments.id})::int`,
        lastVisit: sql<Date | null>`max(${appointments.startsAt})`,
        totalPaidClp: sql<number>`coalesce(sum(${appointments.amountPaidClp}), 0)::int`,
      })
      .from(customers)
      .leftJoin(appointments, eq(appointments.customerId, customers.id))
      .where(conditions.length ? and(...conditions) : undefined)
      .groupBy(customers.id)
      .orderBy(customers.id)
      .limit(input.limit);

    return {
      items: rows,
      nextCursor: rows.length === input.limit ? rows[rows.length - 1].id : null,
    };
  }),

  /** Ficha completa: datos, historial de citas y sus pagos. */
  get: adminProcedure.input(idInput).query(async ({ input }) => {
    const found = await db.select().from(customers).where(eq(customers.id, input.id)).limit(1);
    const customer = found[0];
    if (!customer) throw new TRPCError({ code: "NOT_FOUND", message: "La clienta no existe." });

    const history = await db
      .select({
        id: appointments.id,
        publicId: appointments.publicId,
        status: appointments.status,
        startsAt: appointments.startsAt,
        priceClp: appointments.priceClp,
        amountPaidClp: appointments.amountPaidClp,
        serviceName: services.name,
      })
      .from(appointments)
      .innerJoin(services, eq(appointments.serviceId, services.id))
      .where(eq(appointments.customerId, input.id))
      .orderBy(desc(appointments.startsAt))
      .limit(100);

    const appointmentIds = history.map(item => item.id);
    const paymentHistory = appointmentIds.length
      ? await db
          .select({
            id: payments.id,
            appointmentId: payments.appointmentId,
            kind: payments.kind,
            status: payments.status,
            amountClp: payments.amountClp,
            createdAt: payments.createdAt,
          })
          .from(payments)
          .where(sql`${payments.appointmentId} = ANY(${appointmentIds})`)
          .orderBy(desc(payments.createdAt))
      : [];

    return { customer, history, payments: paymentHistory };
  }),

  update: adminProcedure.input(customerUpdateSchema).mutation(async ({ input }) => {
    const [updated] = await db
      .update(customers)
      .set({ name: input.name, phone: input.phone, notes: input.notes ?? null, updatedAt: new Date() })
      .where(eq(customers.id, input.id))
      .returning();

    if (!updated) throw new TRPCError({ code: "NOT_FOUND", message: "La clienta no existe." });
    return updated;
  }),

  sendEmail: adminProcedure.input(customerSendEmailSchema).mutation(async ({ input }) => {
    const found = await db.select().from(customers).where(eq(customers.id, input.id)).limit(1);
    const customer = found[0];
    if (!customer) throw new TRPCError({ code: "NOT_FOUND", message: "La clienta no existe." });

    await enqueueManualMessage(customer.email, input.subject, input.body);
    return { ok: true as const };
  }),

  /**
   * Un correo por destinataria en la cola, no un envío en caliente: así un
   * envío grande no revienta el tiempo límite de la función serverless. El
   * cron ya existente los va despachando de a 25 por pasada.
   */
  broadcast: adminProcedure.input(customerBroadcastSchema).mutation(async ({ input }) => {
    const recipients = await listAllCustomers(input.filter);
    for (const customer of recipients) {
      await enqueueManualMessage(customer.email, input.subject, input.body);
    }
    return { ok: true as const, recipientCount: recipients.length };
  }),
});
