import { TRPCError } from "@trpc/server";
import { and, asc, count, desc, eq, gte, inArray, isNull, lte, sql } from "drizzle-orm";
import { z } from "zod";
import {
  BLOCKING_APPOINTMENT_STATUSES,
  appointmentListQuerySchema,
  businessHoursInputSchema,
  customerSendEmailSchema,
  postInputSchema,
  rescheduleAppointmentSchema,
  schedulingSettingsInputSchema,
  serviceInputSchema,
  timeOffInputSchema,
} from "@naty/shared";
import {
  db,
  appointments,
  businessHours,
  customers,
  emailJobs,
  leads,
  locations,
  posts,
  schedulingSettings,
  services,
  timeOff,
} from "../db";
import { rescheduleAppointment } from "../services/booking";
import { dropPendingReminders, enqueueManualMessage, enqueueNow, scheduleReminders } from "../services/email";
import { revalidatePaths } from "../services/revalidate";
import { adminProcedure, router } from "../trpc";
import { adminCustomersRouter } from "./admin-customers";

const idInput = z.object({ id: z.number().int().positive() });

/** Carga la cita junto al correo de la clienta, que hace falta para avisarle. */
async function loadAppointment(id: number) {
  const rows = await db
    .select({ appointment: appointments, customerEmail: customers.email })
    .from(appointments)
    .innerJoin(customers, eq(appointments.customerId, customers.id))
    .where(eq(appointments.id, id))
    .limit(1);

  const found = rows[0];
  if (!found) throw new TRPCError({ code: "NOT_FOUND", message: "La cita no existe." });
  return found;
}

const servicesRouter = router({
  list: adminProcedure.query(() =>
    db.select().from(services).orderBy(asc(services.sortOrder), asc(services.id)),
  ),

  create: adminProcedure.input(serviceInputSchema).mutation(async ({ input }) => {
    const [created] = await db
      .insert(services)
      .values({ ...input, imageUrl: input.imageUrl || null })
      .returning();
    await revalidatePaths(["/", "/servicios", `/servicios/${created.slug}`]);
    return created;
  }),

  update: adminProcedure
    .input(idInput.extend({ data: serviceInputSchema.partial() }))
    .mutation(async ({ input }) => {
      const [updated] = await db
        .update(services)
        .set({ ...input.data, updatedAt: new Date() })
        .where(eq(services.id, input.id))
        .returning();

      if (!updated) throw new TRPCError({ code: "NOT_FOUND", message: "El servicio no existe." });
      await revalidatePaths(["/", "/servicios", `/servicios/${updated.slug}`]);
      return updated;
    }),

  archive: adminProcedure.input(idInput).mutation(async ({ input }) => {
    // Los servicios no se borran: hay citas históricas que los referencian.
    // Desactivarlos los saca del sitio sin romper ese historial.
    const [updated] = await db
      .update(services)
      .set({ active: false, updatedAt: new Date() })
      .where(eq(services.id, input.id))
      .returning();

    if (!updated) throw new TRPCError({ code: "NOT_FOUND", message: "El servicio no existe." });
    await revalidatePaths(["/", "/servicios", `/servicios/${updated.slug}`]);
    return updated;
  }),

  reorder: adminProcedure
    .input(z.object({ order: z.array(z.number().int().positive()).max(100) }))
    .mutation(async ({ input }) => {
      await db.transaction(async tx => {
        for (const [index, id] of input.order.entries()) {
          await tx.update(services).set({ sortOrder: index }).where(eq(services.id, id));
        }
      });
      await revalidatePaths(["/", "/servicios"]);
      return { ok: true as const };
    }),
});

const scheduleRouter = router({
  getHours: adminProcedure.input(z.object({ locationId: z.number().int().positive() })).query(({ input }) =>
    db
      .select()
      .from(businessHours)
      .where(eq(businessHours.locationId, input.locationId))
      .orderBy(asc(businessHours.weekday), asc(businessHours.startMinute)),
  ),

  setHours: adminProcedure.input(businessHoursInputSchema).mutation(async ({ input }) => {
    // La plantilla semanal se reemplaza completa para esa sede: es más simple
    // de razonar que aplicar altas y bajas parciales, y el volumen es de unas
    // pocas filas. Sólo borra las filas de esta sede, no las de la otra.
    await db.transaction(async tx => {
      await tx.delete(businessHours).where(eq(businessHours.locationId, input.locationId));
      if (input.entries.length > 0) {
        await tx
          .insert(businessHours)
          .values(input.entries.map(entry => ({ ...entry, locationId: input.locationId })));
      }
    });
    return { ok: true as const };
  }),

  listTimeOff: adminProcedure.input(z.object({ locationId: z.number().int().positive() })).query(({ input }) =>
    db
      .select()
      .from(timeOff)
      .where(eq(timeOff.locationId, input.locationId))
      .orderBy(desc(timeOff.startsAt))
      .limit(200),
  ),

  createTimeOff: adminProcedure.input(timeOffInputSchema).mutation(async ({ input }) => {
    const [created] = await db
      .insert(timeOff)
      .values({
        locationId: input.locationId,
        startsAt: new Date(input.startsAt),
        endsAt: new Date(input.endsAt),
        reason: input.reason,
      })
      .returning();
    return created;
  }),

  deleteTimeOff: adminProcedure.input(idInput).mutation(async ({ input }) => {
    await db.delete(timeOff).where(eq(timeOff.id, input.id));
    return { ok: true as const };
  }),

  getSettings: adminProcedure.query(async () => {
    const rows = await db.select().from(schedulingSettings).where(eq(schedulingSettings.id, 1)).limit(1);
    return rows[0] ?? null;
  }),

  updateSettings: adminProcedure.input(schedulingSettingsInputSchema).mutation(async ({ input }) => {
    const [updated] = await db
      .insert(schedulingSettings)
      .values({ id: 1, ...input })
      .onConflictDoUpdate({
        target: schedulingSettings.id,
        set: { ...input, updatedAt: new Date() },
      })
      .returning();
    return updated;
  }),
});

const appointmentsRouter = router({
  list: adminProcedure.input(appointmentListQuerySchema.optional()).query(async ({ input }) => {
    const conditions = [];
    if (input?.from) conditions.push(gte(appointments.startsAt, new Date(input.from)));
    if (input?.to) conditions.push(lte(appointments.startsAt, new Date(input.to)));
    if (input?.status?.length) conditions.push(inArray(appointments.status, input.status));

    return db
      .select({
        id: appointments.id,
        publicId: appointments.publicId,
        status: appointments.status,
        startsAt: appointments.startsAt,
        endsAt: appointments.endsAt,
        priceClp: appointments.priceClp,
        amountPaidClp: appointments.amountPaidClp,
        customerNotes: appointments.customerNotes,
        adminNotes: appointments.adminNotes,
        serviceName: services.name,
        durationMin: services.durationMin,
        customerName: customers.name,
        customerEmail: customers.email,
        customerPhone: customers.phone,
        locationName: locations.name,
      })
      .from(appointments)
      .innerJoin(services, eq(appointments.serviceId, services.id))
      .innerJoin(customers, eq(appointments.customerId, customers.id))
      .innerJoin(locations, eq(appointments.locationId, locations.id))
      .where(conditions.length ? and(...conditions) : undefined)
      .orderBy(asc(appointments.startsAt))
      .limit(500);
  }),

  approve: adminProcedure.input(idInput).mutation(async ({ input }) => {
    const { appointment, customerEmail } = await loadAppointment(input.id);

    if (appointment.status === "confirmed") return appointment;

    const [updated] = await db
      .update(appointments)
      .set({ status: "confirmed", updatedAt: new Date() })
      .where(eq(appointments.id, input.id))
      .returning();

    await enqueueNow(updated, "booking_confirmed", customerEmail);
    await scheduleReminders(updated, customerEmail);
    return updated;
  }),

  reschedule: adminProcedure.input(rescheduleAppointmentSchema).mutation(async ({ input }) => {
    const { customerEmail } = await loadAppointment(input.id);
    const updated = await rescheduleAppointment(input.id, new Date(input.startsAt));

    // Los recordatorios apuntaban a la hora anterior: se borran y se reprograman
    // sobre la nueva, o la clienta recibiría el aviso a destiempo.
    await dropPendingReminders(updated.id);
    await enqueueNow(updated, "rescheduled", customerEmail);
    if (updated.status === "confirmed") {
      await scheduleReminders(updated, customerEmail);
    }

    return updated;
  }),

  cancel: adminProcedure.input(idInput).mutation(async ({ input }) => {
    const { customerEmail } = await loadAppointment(input.id);

    const [updated] = await db
      .update(appointments)
      .set({ status: "cancelled", updatedAt: new Date() })
      .where(eq(appointments.id, input.id))
      .returning();

    await dropPendingReminders(updated.id);
    await enqueueNow(updated, "cancelled", customerEmail);
    return updated;
  }),

  setOutcome: adminProcedure
    .input(idInput.extend({ status: z.enum(["completed", "no_show"]) }))
    .mutation(async ({ input }) => {
      const [updated] = await db
        .update(appointments)
        .set({ status: input.status, updatedAt: new Date() })
        .where(eq(appointments.id, input.id))
        .returning();

      if (!updated) throw new TRPCError({ code: "NOT_FOUND", message: "La cita no existe." });
      await dropPendingReminders(updated.id);
      return updated;
    }),

  setNotes: adminProcedure
    .input(idInput.extend({ adminNotes: z.string().max(4000) }))
    .mutation(async ({ input }) => {
      const [updated] = await db
        .update(appointments)
        .set({ adminNotes: input.adminNotes, updatedAt: new Date() })
        .where(eq(appointments.id, input.id))
        .returning();
      return updated;
    }),
});

const postsRouter = router({
  list: adminProcedure.query(() => db.select().from(posts).orderBy(desc(posts.createdAt))),

  create: adminProcedure.input(postInputSchema).mutation(async ({ input }) => {
    const { published, ...rest } = input;
    const [created] = await db
      .insert(posts)
      .values({
        ...rest,
        coverImageUrl: rest.coverImageUrl || null,
        publishedAt: published ? new Date() : null,
      })
      .returning();

    await revalidatePaths(["/blog", `/blog/${created.slug}`]);
    return created;
  }),

  update: adminProcedure
    .input(idInput.extend({ data: postInputSchema.partial() }))
    .mutation(async ({ input }) => {
      const current = await db.select().from(posts).where(eq(posts.id, input.id)).limit(1);
      if (!current[0]) throw new TRPCError({ code: "NOT_FOUND", message: "El artículo no existe." });

      const { published, ...rest } = input.data;
      // Publicar fija la fecha una sola vez; despublicar la borra. Así un
      // artículo que se corrige no salta al principio del blog.
      const publishedAt =
        published === undefined
          ? current[0].publishedAt
          : published
            ? (current[0].publishedAt ?? new Date())
            : null;

      const [updated] = await db
        .update(posts)
        .set({ ...rest, publishedAt, updatedAt: new Date() })
        .where(eq(posts.id, input.id))
        .returning();

      await revalidatePaths(["/blog", `/blog/${updated.slug}`]);
      return updated;
    }),

  delete: adminProcedure.input(idInput).mutation(async ({ input }) => {
    const [deleted] = await db.delete(posts).where(eq(posts.id, input.id)).returning();
    if (deleted) await revalidatePaths(["/blog", `/blog/${deleted.slug}`]);
    return { ok: true as const };
  }),
});

const leadsRouter = router({
  list: adminProcedure.query(() =>
    db
      .select({
        id: leads.id,
        email: leads.email,
        name: leads.name,
        phone: leads.phone,
        step: leads.step,
        createdAt: leads.createdAt,
        serviceName: services.name,
      })
      .from(leads)
      .leftJoin(services, eq(leads.serviceId, services.id))
      .where(isNull(leads.convertedAt))
      .orderBy(desc(leads.createdAt))
      .limit(100),
  ),

  /** Reservó por otra vía (teléfono, en persona): se cierra el seguimiento. */
  markConverted: adminProcedure.input(idInput).mutation(async ({ input }) => {
    const [updated] = await db
      .update(leads)
      .set({ convertedAt: new Date() })
      .where(eq(leads.id, input.id))
      .returning();
    if (!updated) throw new TRPCError({ code: "NOT_FOUND", message: "El contacto no existe." });
    return updated;
  }),

  /** No procede el seguimiento (no responde, no le interesa): sale de la lista. */
  dismiss: adminProcedure.input(idInput).mutation(async ({ input }) => {
    const [updated] = await db
      .update(leads)
      .set({ convertedAt: new Date() })
      .where(eq(leads.id, input.id))
      .returning();
    if (!updated) throw new TRPCError({ code: "NOT_FOUND", message: "El contacto no existe." });
    return updated;
  }),

  sendEmail: adminProcedure.input(customerSendEmailSchema).mutation(async ({ input }) => {
    const found = await db.select().from(leads).where(eq(leads.id, input.id)).limit(1);
    const lead = found[0];
    if (!lead) throw new TRPCError({ code: "NOT_FOUND", message: "El contacto no existe." });

    await enqueueManualMessage(lead.email, input.subject, input.body);
    return { ok: true as const };
  }),
});

export const adminRouter = router({
  services: servicesRouter,
  schedule: scheduleRouter,
  appointments: appointmentsRouter,
  posts: postsRouter,
  customers: adminCustomersRouter,

  dashboard: adminProcedure.query(async () => {
    const now = new Date();
    const in7Days = new Date(now.getTime() + 7 * 86_400_000);
    const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));

    const [upcoming, pendingApproval, monthRevenue, openLeads, failedEmails] = await Promise.all([
      db
        .select({
          id: appointments.id,
          publicId: appointments.publicId,
          startsAt: appointments.startsAt,
          status: appointments.status,
          serviceName: services.name,
          customerName: customers.name,
          locationName: locations.name,
        })
        .from(appointments)
        .innerJoin(services, eq(appointments.serviceId, services.id))
        .innerJoin(customers, eq(appointments.customerId, customers.id))
        .innerJoin(locations, eq(appointments.locationId, locations.id))
        .where(
          and(
            gte(appointments.startsAt, now),
            lte(appointments.startsAt, in7Days),
            inArray(appointments.status, [...BLOCKING_APPOINTMENT_STATUSES]),
          ),
        )
        .orderBy(asc(appointments.startsAt))
        .limit(20),

      db
        .select({ total: count() })
        .from(appointments)
        .where(eq(appointments.status, "pending_approval")),

      db
        .select({ total: sql<number>`coalesce(sum(${appointments.amountPaidClp}), 0)::int` })
        .from(appointments)
        .where(and(gte(appointments.startsAt, monthStart), eq(appointments.status, "completed"))),

      db
        .select({ total: count() })
        .from(leads)
        .where(isNull(leads.convertedAt)),

      db.select({ total: count() }).from(emailJobs).where(eq(emailJobs.status, "failed")),
    ]);

    return {
      upcoming,
      pendingApprovalCount: pendingApproval[0]?.total ?? 0,
      monthRevenueClp: monthRevenue[0]?.total ?? 0,
      openLeadsCount: openLeads[0]?.total ?? 0,
      failedEmailCount: failedEmails[0]?.total ?? 0,
    };
  }),

  leads: leadsRouter,
});
