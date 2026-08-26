import { TRPCError } from "@trpc/server";
import { and, desc, eq, gt, ilike, or, sql } from "drizzle-orm";
import { z } from "zod";
import { customerListQuerySchema, customerSendEmailSchema, customerUpdateSchema } from "@naty/shared";
import { db, appointments, customers, payments, services } from "../db";
import { enqueueManualMessage } from "../services/email";
import { adminProcedure, router } from "../trpc";

const idInput = z.object({ id: z.number().int().positive() });

export const adminCustomersRouter = router({
  /** Buscador de clientas con el resumen que se ve en el listado. */
  list: adminProcedure.input(customerListQuerySchema).query(async ({ input }) => {
    const term = input.search?.trim();
    const conditions = [
      term ? or(ilike(customers.name, `%${term}%`), ilike(customers.email, `%${term}%`), ilike(customers.phone, `%${term}%`)) : undefined,
      input.cursor ? gt(customers.id, input.cursor) : undefined,
    ].filter(Boolean);

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
});
