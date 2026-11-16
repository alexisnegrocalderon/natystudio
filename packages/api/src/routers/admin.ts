import { TRPCError } from "@trpc/server";
import { and, asc, count, desc, eq, gte, inArray, isNull, lte, sql } from "drizzle-orm";
import { z } from "zod";
import {
  BLOCKING_APPOINTMENT_STATUSES,
  appointmentListQuerySchema,
  businessHoursInputSchema,
  customerSendEmailSchema,
  dateOverrideInputSchema,
  dateOverrideListQuerySchema,
  draftEmailInputSchema,
  draftServiceDescriptionInputSchema,
  expenseInputSchema,
  financeSummaryQuerySchema,
  postInputSchema,
  rescheduleAppointmentSchema,
  schedulingSettingsInputSchema,
  serviceInputSchema,
  timeOffInputSchema,
} from "@naty/shared";
import {
  db,
  appointments,
  appointmentServices,
  businessHours,
  customers,
  dateOverrides,
  emailJobs,
  expenses,
  leadReminders,
  leads,
  locations,
  payments,
  posts,
  schedulingSettings,
  services,
  timeOff,
} from "../db";
import { ENV } from "../env";
import { ensureReminderSchema, getReminderSettings, saveReminderSettings } from "../services/abandoned-reminders";
import { salesPeriodStarts } from "../services/sales-periods";
import { aiEnabled, draftEmail, draftServiceDescription } from "../services/ai";
import { rescheduleAppointment } from "../services/booking";
import { dropPendingReminders, enqueueManualMessage, enqueueNow, scheduleReminders } from "../services/email";
import { deleteMpConnection, getMpConnection } from "../services/mercadopago-connection";
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

  listDateOverrides: adminProcedure.input(dateOverrideListQuerySchema).query(({ input }) =>
    db
      .select()
      .from(dateOverrides)
      .where(
        and(
          eq(dateOverrides.locationId, input.locationId),
          gte(dateOverrides.day, input.from),
          lte(dateOverrides.day, input.to),
        ),
      )
      .orderBy(asc(dateOverrides.day), asc(dateOverrides.startMinute))
      .limit(500),
  ),

  setDayOverride: adminProcedure.input(dateOverrideInputSchema).mutation(async ({ input }) => {
    const today = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Santiago" }).format(new Date());
    if (input.day < today) {
      throw new TRPCError({ code: "BAD_REQUEST", message: "No se puede editar una fecha pasada." });
    }

    // Igual que setHours: se reemplaza completo, pero acotado a un solo
    // (sede, día) — nunca toca otras fechas ni la plantilla semanal.
    await db.transaction(async tx => {
      await tx
        .delete(dateOverrides)
        .where(and(eq(dateOverrides.locationId, input.locationId), eq(dateOverrides.day, input.day)));
      if (input.entries.length > 0) {
        await tx
          .insert(dateOverrides)
          .values(input.entries.map(entry => ({ ...entry, locationId: input.locationId, day: input.day })));
      }
    });
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

    const rows = await db
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
        customerName: customers.name,
        customerEmail: customers.email,
        customerPhone: customers.phone,
        locationName: locations.name,
      })
      .from(appointments)
      .innerJoin(customers, eq(appointments.customerId, customers.id))
      .innerJoin(locations, eq(appointments.locationId, locations.id))
      .where(conditions.length ? and(...conditions) : undefined)
      .orderBy(asc(appointments.startsAt))
      .limit(500);

    if (rows.length === 0) return [];

    const serviceRows = await db
      .select({ appointmentId: appointmentServices.appointmentId, name: services.name, durationMin: appointmentServices.durationMin })
      .from(appointmentServices)
      .innerJoin(services, eq(appointmentServices.serviceId, services.id))
      .where(inArray(appointmentServices.appointmentId, rows.map(row => row.id)));

    const servicesByAppointmentId = new Map<number, { name: string; durationMin: number }[]>();
    for (const row of serviceRows) {
      const list = servicesByAppointmentId.get(row.appointmentId) ?? [];
      list.push({ name: row.name, durationMin: row.durationMin });
      servicesByAppointmentId.set(row.appointmentId, list);
    }

    return rows.map(row => {
      const items = servicesByAppointmentId.get(row.id) ?? [];
      return {
        ...row,
        serviceName: items.map(item => item.name).join(" + "),
        durationMin: items.reduce((sum, item) => sum + item.durationMin, 0),
      };
    });
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

  /**
   * Edita la reserva completa desde la agenda: datos de la clienta, notas y estado. Cambiar a "confirmada"
   * o "cancelada" hace lo mismo que los botones de siempre (avisa a la clienta y programa o borra los
   * recordatorios). La fecha y hora se cambian aparte con `reschedule`.
   */
  update: adminProcedure
    .input(
      idInput.extend({
        customerName: z.string().trim().min(2, "Escribe el nombre.").max(120),
        customerEmail: z.string().trim().toLowerCase().max(320).pipe(z.email("El correo no es válido.")),
        customerPhone: z.string().trim().min(6, "Escribe el teléfono.").max(20),
        customerNotes: z.string().max(2000),
        adminNotes: z.string().max(4000),
        status: z.enum(["pending_approval", "confirmed", "completed", "cancelled", "no_show"]).optional(),
      }),
    )
    .mutation(async ({ input }) => {
      const { appointment, customerEmail: currentEmail } = await loadAppointment(input.id);

      if (input.customerEmail !== currentEmail) {
        const [taken] = await db.select({ id: customers.id }).from(customers).where(eq(customers.email, input.customerEmail)).limit(1);
        if (taken && taken.id !== appointment.customerId) {
          throw new TRPCError({ code: "CONFLICT", message: "Ya existe otra clienta con ese correo." });
        }
      }

      await db
        .update(customers)
        .set({ name: input.customerName, email: input.customerEmail, phone: input.customerPhone, updatedAt: new Date() })
        .where(eq(customers.id, appointment.customerId));

      let updated;
      try {
        [updated] = await db
          .update(appointments)
          .set({
            customerNotes: input.customerNotes.trim() || null,
            adminNotes: input.adminNotes.trim() || null,
            ...(input.status ? { status: input.status } : {}),
            updatedAt: new Date(),
          })
          .where(eq(appointments.id, input.id))
          .returning();
      } catch (error) {
        // Reactivar una cita cancelada en un horario que otra reserva ya ocupó.
        if (typeof error === "object" && error !== null && (error as { code?: string }).code === "23P01") {
          throw new TRPCError({ code: "CONFLICT", message: "Ese horario ya está ocupado por otra reserva." });
        }
        throw error;
      }

      if (input.status && input.status !== appointment.status) {
        if (input.status === "confirmed") {
          await enqueueNow(updated, "booking_confirmed", input.customerEmail);
          await scheduleReminders(updated, input.customerEmail);
        } else if (input.status === "cancelled") {
          await dropPendingReminders(updated.id);
          await enqueueNow(updated, "cancelled", input.customerEmail);
        } else {
          await dropPendingReminders(updated.id);
        }
      }

      return updated;
    }),

  /**
   * Borra la reserva sin dejar rastro y sin avisar a la clienta (para avisarle, se cancela). Si ya tiene un
   * pago aprobado no se puede borrar: el registro de ese cobro alimenta Ventas y el panel de ANC.
   */
  delete: adminProcedure.input(idInput).mutation(async ({ input }) => {
    await loadAppointment(input.id);

    const [paid] = await db
      .select({ total: count() })
      .from(payments)
      .where(and(eq(payments.appointmentId, input.id), eq(payments.status, "approved")));
    if ((paid?.total ?? 0) > 0) {
      throw new TRPCError({
        code: "BAD_REQUEST",
        message: "Esta reserva tiene un pago aprobado, así que no se puede borrar. Cancélala para conservar el registro del cobro.",
      });
    }

    await db.delete(appointments).where(eq(appointments.id, input.id));
    return { ok: true as const };
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

const remindersRouter = router({
  get: adminProcedure.query(() => getReminderSettings()),

  update: adminProcedure
    .input(
      z.object({
        abandonedEnabled: z.boolean(),
        abandonedDelayHours: z.number().int().min(1).max(72),
      }),
    )
    .mutation(({ input }) => saveReminderSettings(input)),
});

const leadsRouter = router({
  list: adminProcedure.query(async () => {
    await ensureReminderSchema();
    return db
      .select({
        id: leads.id,
        email: leads.email,
        name: leads.name,
        phone: leads.phone,
        step: leads.step,
        createdAt: leads.createdAt,
        serviceName: services.name,
        reminderSentAt: leadReminders.sentAt,
      })
      .from(leads)
      .leftJoin(services, eq(leads.serviceId, services.id))
      .leftJoin(leadReminders, eq(leadReminders.leadId, leads.id))
      .where(isNull(leads.convertedAt))
      .orderBy(desc(leads.createdAt))
      .limit(100);
  }),

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

/**
 * Ingresos: se calculan sobre `appointments.amountPaidClp` de citas
 * "completed" (el mismo criterio que ya usa `dashboard` para "Cobrado este
 * mes", ver más abajo), agrupado por mes/servicio/sede en vez de sumado de
 * una sola vez. Se agrupa con `date_trunc` en UTC — para un gráfico de
 * tendencia mensual el desfase de minutos frente a la hora de Chile no
 * amerita reusar el ensanchado de rango que sí hace falta para turnos.
 */
const financeRouter = router({
  summary: adminProcedure.input(financeSummaryQuerySchema).query(async ({ input }) => {
    const from = new Date(input.from);
    const to = new Date(input.to);
    // Ingresos = pagos aprobados en el período (lo que realmente entró), con la parte de Naty: lo cobrado
    // menos las comisiones. Es el mismo criterio del Inicio y de la lista de Compras.
    const incomeSum = sql<number>`coalesce(sum(${payments.amountClp} - ${payments.feeClp}), 0)::int`;
    const monthBucket = sql<string>`to_char(date_trunc('month', ${payments.createdAt} AT TIME ZONE 'America/Santiago'), 'YYYY-MM')`;
    const paidInRange = and(eq(payments.status, "approved"), gte(payments.createdAt, from), lte(payments.createdAt, to));

    const [incomeByMonth, incomeByService, incomeByLocation, appointmentsByStatus, expenseTotalRow] =
      await Promise.all([
        db
          .select({ month: monthBucket, total: incomeSum })
          .from(payments)
          .where(paidInRange)
          .groupBy(monthBucket)
          .orderBy(monthBucket),

        db
          .select({ name: services.name, total: incomeSum })
          .from(payments)
          .innerJoin(appointments, eq(payments.appointmentId, appointments.id))
          .innerJoin(services, eq(appointments.serviceId, services.id))
          .where(paidInRange)
          .groupBy(services.name)
          .orderBy(desc(incomeSum)),

        db
          .select({ name: locations.name, total: incomeSum })
          .from(payments)
          .innerJoin(appointments, eq(payments.appointmentId, appointments.id))
          .innerJoin(locations, eq(appointments.locationId, locations.id))
          .where(paidInRange)
          .groupBy(locations.name)
          .orderBy(desc(incomeSum)),

        db
          .select({ status: appointments.status, total: count() })
          .from(appointments)
          .where(and(gte(appointments.startsAt, from), lte(appointments.startsAt, to)))
          .groupBy(appointments.status),

        db
          .select({ total: sql<number>`coalesce(sum(${expenses.amountClp}), 0)::int` })
          .from(expenses)
          .where(and(gte(expenses.incurredAt, from), lte(expenses.incurredAt, to))),
      ]);

    const incomeTotal = incomeByMonth.reduce((sum, row) => sum + row.total, 0);
    const expenseTotal = expenseTotalRow[0]?.total ?? 0;

    return {
      incomeByMonth,
      incomeByService,
      incomeByLocation,
      appointmentsByStatus,
      incomeTotal,
      expenseTotal,
      netProfit: incomeTotal - expenseTotal,
    };
  }),

  /**
   * Compras: cada pago aprobado en el rango, con los datos de contacto de quien pagó para escribirle directo.
   * `netClp` es la parte de Naty (lo cobrado menos las comisiones), la misma que suma el dashboard.
   */
  listPurchases: adminProcedure.input(financeSummaryQuerySchema).query(({ input }) =>
    db
      .select({
        id: payments.id,
        paidAt: payments.createdAt,
        kind: payments.kind,
        chargedClp: payments.amountClp,
        netClp: sql<number>`(${payments.amountClp} - ${payments.feeClp})::int`,
        appointmentStatus: appointments.status,
        startsAt: appointments.startsAt,
        customerName: customers.name,
        customerEmail: customers.email,
        customerPhone: customers.phone,
        serviceName: services.name,
      })
      .from(payments)
      .innerJoin(appointments, eq(payments.appointmentId, appointments.id))
      .innerJoin(customers, eq(appointments.customerId, customers.id))
      .innerJoin(services, eq(appointments.serviceId, services.id))
      .where(and(eq(payments.status, "approved"), gte(payments.createdAt, new Date(input.from)), lte(payments.createdAt, new Date(input.to))))
      .orderBy(desc(payments.createdAt))
      .limit(200),
  ),

  listExpenses: adminProcedure.input(financeSummaryQuerySchema).query(({ input }) =>
    db
      .select({
        id: expenses.id,
        description: expenses.description,
        amountClp: expenses.amountClp,
        category: expenses.category,
        incurredAt: expenses.incurredAt,
        locationName: locations.name,
      })
      .from(expenses)
      .leftJoin(locations, eq(expenses.locationId, locations.id))
      .where(and(gte(expenses.incurredAt, new Date(input.from)), lte(expenses.incurredAt, new Date(input.to))))
      .orderBy(desc(expenses.incurredAt))
      .limit(200),
  ),

  createExpense: adminProcedure.input(expenseInputSchema).mutation(async ({ input }) => {
    const [created] = await db
      .insert(expenses)
      .values({
        description: input.description,
        amountClp: input.amountClp,
        category: input.category,
        locationId: input.locationId,
        incurredAt: new Date(input.incurredAt),
      })
      .returning();
    return created;
  }),

  deleteExpense: adminProcedure.input(idInput).mutation(async ({ input }) => {
    await db.delete(expenses).where(eq(expenses.id, input.id));
    return { ok: true as const };
  }),
});

const aiRouter = router({
  enabled: adminProcedure.query(() => aiEnabled),

  draftEmail: adminProcedure.input(draftEmailInputSchema).mutation(({ input }) => draftEmail(input)),

  draftServiceDescription: adminProcedure
    .input(draftServiceDescriptionInputSchema)
    .mutation(({ input }) => draftServiceDescription(input)),
});

const mercadopagoRouter = router({
  /** Estado de la conexión de Naty, para mostrar en Ajustes. */
  status: adminProcedure.query(async () => {
    const configured = Boolean(ENV.mercadoPago.clientId && ENV.mercadoPago.clientSecret);
    const connection = await getMpConnection();
    return {
      configured,
      connected: Boolean(connection),
      /** PAYMENTS_ENABLED: sin esto la cuenta puede estar conectada y aun así no cobrarse nada. */
      paymentsEnabled: ENV.paymentsEnabled,
      /** La llave pública de la cuenta conectada, que el formulario de pago necesita. */
      checkoutReady: Boolean(connection?.sellerPublicKey),
      email: connection?.sellerEmail ?? null,
      connectedAt: connection?.connectedAt ?? null,
    };
  }),

  disconnect: adminProcedure.mutation(async () => {
    await deleteMpConnection();
    return { ok: true };
  }),
});

export const adminRouter = router({
  services: servicesRouter,
  schedule: scheduleRouter,
  appointments: appointmentsRouter,
  posts: postsRouter,
  customers: adminCustomersRouter,
  finance: financeRouter,
  ai: aiRouter,
  mercadopago: mercadopagoRouter,

  dashboard: adminProcedure.query(async () => {
    const now = new Date();
    const in7Days = new Date(now.getTime() + 7 * 86_400_000);
    const periods = salesPeriodStarts(now);
    // Lo que le corresponde a Naty de cada pago: lo cobrado menos las comisiones (igual que Ventas > Compras).
    const net = sql<number>`(${payments.amountClp} - ${payments.feeClp})`;
    const sumSince = (since: Date) =>
      sql<number>`coalesce(sum(${net}) filter (where ${payments.createdAt} >= ${since}), 0)::int`;
    const countSince = (since: Date) => sql<number>`(count(*) filter (where ${payments.createdAt} >= ${since}))::int`;

    /** Citas con lo que hace falta para contactar a la clienta y abrir el editor desde el inicio. */
    const appointmentCards = (where: ReturnType<typeof and>, limit: number) =>
      db
        .select({
          id: appointments.id,
          publicId: appointments.publicId,
          startsAt: appointments.startsAt,
          status: appointments.status,
          customerName: customers.name,
          customerEmail: customers.email,
          customerPhone: customers.phone,
          customerNotes: appointments.customerNotes,
          adminNotes: appointments.adminNotes,
          locationName: locations.name,
        })
        .from(appointments)
        .innerJoin(customers, eq(appointments.customerId, customers.id))
        .innerJoin(locations, eq(appointments.locationId, locations.id))
        .where(where)
        .orderBy(asc(appointments.startsAt))
        .limit(limit);

    const [upcomingRows, todayRows, pendingRows, pendingApproval, salesRow, recentPurchases, openLeads, failedEmails] =
      await Promise.all([
        appointmentCards(
          and(
            gte(appointments.startsAt, periods.tomorrow),
            lte(appointments.startsAt, in7Days),
            inArray(appointments.status, [...BLOCKING_APPOINTMENT_STATUSES]),
          ),
          20,
        ),
        appointmentCards(
          and(
            gte(appointments.startsAt, periods.today),
            lte(appointments.startsAt, periods.tomorrow),
            inArray(appointments.status, ["pending_payment", "pending_approval", "confirmed", "completed", "no_show"]),
          ),
          30,
        ),
        appointmentCards(and(eq(appointments.status, "pending_approval"), gte(appointments.startsAt, periods.today)), 10),

        db.select({ total: count() }).from(appointments).where(eq(appointments.status, "pending_approval")),

        db
          .select({
            today: sumSince(periods.today),
            todayCount: countSince(periods.today),
            week: sumSince(periods.week),
            weekCount: countSince(periods.week),
            month: sumSince(periods.month),
            monthCount: countSince(periods.month),
          })
          .from(payments)
          .where(and(eq(payments.status, "approved"), gte(payments.createdAt, periods.month < periods.week ? periods.month : periods.week))),

        db
          .select({
            id: payments.id,
            paidAt: payments.createdAt,
            netClp: sql<number>`(${payments.amountClp} - ${payments.feeClp})::int`,
            customerName: customers.name,
            customerEmail: customers.email,
            customerPhone: customers.phone,
            serviceName: services.name,
          })
          .from(payments)
          .innerJoin(appointments, eq(payments.appointmentId, appointments.id))
          .innerJoin(customers, eq(appointments.customerId, customers.id))
          .innerJoin(services, eq(appointments.serviceId, services.id))
          .where(eq(payments.status, "approved"))
          .orderBy(desc(payments.createdAt))
          .limit(5),

        db.select({ total: count() }).from(leads).where(isNull(leads.convertedAt)),

        db.select({ total: count() }).from(emailJobs).where(eq(emailJobs.status, "failed")),
      ]);

    const ids = [...new Set([...upcomingRows, ...todayRows, ...pendingRows].map(row => row.id))];
    const serviceRows = ids.length
      ? await db
          .select({ appointmentId: appointmentServices.appointmentId, name: services.name })
          .from(appointmentServices)
          .innerJoin(services, eq(appointmentServices.serviceId, services.id))
          .where(inArray(appointmentServices.appointmentId, ids))
      : [];
    const namesByAppointmentId = new Map<number, string[]>();
    for (const row of serviceRows) {
      const list = namesByAppointmentId.get(row.appointmentId) ?? [];
      list.push(row.name);
      namesByAppointmentId.set(row.appointmentId, list);
    }
    const withServices = <T extends { id: number }>(rows: T[]) =>
      rows.map(row => ({ ...row, serviceName: (namesByAppointmentId.get(row.id) ?? []).join(" + ") }));

    const sales = salesRow[0];
    return {
      sales: {
        todayClp: sales?.today ?? 0,
        todayCount: sales?.todayCount ?? 0,
        weekClp: sales?.week ?? 0,
        weekCount: sales?.weekCount ?? 0,
        monthClp: sales?.month ?? 0,
        monthCount: sales?.monthCount ?? 0,
      },
      today: withServices(todayRows),
      pendingApproval: withServices(pendingRows),
      upcoming: withServices(upcomingRows),
      recentPurchases,
      pendingApprovalCount: pendingApproval[0]?.total ?? 0,
      openLeadsCount: openLeads[0]?.total ?? 0,
      failedEmailCount: failedEmails[0]?.total ?? 0,
    };
  }),

  leads: leadsRouter,
  reminders: remindersRouter,
});
