import { TRPCError } from "@trpc/server";
import { and, eq, isNull, sql } from "drizzle-orm";
import {
  availabilityQuerySchema,
  bookingLookupSchema,
  cancelBookingSchema,
  contactFormSchema,
  createBookingSchema,
  leadCaptureSchema,
} from "@naty/shared";
import { ENV } from "../env";
import { db, appointments, customers, leads, locations, services } from "../db";
import { createBooking } from "../services/booking";
import { dropPendingReminders, enqueueManualMessage, enqueueNow } from "../services/email";
import { HOLD_TIMEOUT_MS } from "../services/payments";
import { isRateLimited } from "../services/rateLimit";
import { getAvailability } from "../services/scheduling";
import { publicProcedure, router } from "../trpc";

/** IP del cliente detrás del proxy de Vercel; "unknown" si no viene (dev local). */
function clientIp(req: Request): string {
  return req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
}

export const availabilityRouter = router({
  getSlots: publicProcedure.input(availabilityQuerySchema).query(async ({ input }) => {
    return getAvailability(input.serviceId, input.locationId, input.from, input.to);
  }),
});

/** Datos de la reserva que se pueden mostrar sin autenticación. */
async function loadPublicBooking(publicId: string) {
  const rows = await db
    .select({
      publicId: appointments.publicId,
      status: appointments.status,
      startsAt: appointments.startsAt,
      endsAt: appointments.endsAt,
      priceClp: appointments.priceClp,
      amountPaidClp: appointments.amountPaidClp,
      cancelToken: appointments.cancelToken,
      serviceName: services.name,
      serviceSlug: services.slug,
      durationMin: services.durationMin,
      customerName: customers.name,
      customerEmail: customers.email,
      locationName: locations.name,
      locationAddress: locations.streetAddress,
    })
    .from(appointments)
    .innerJoin(services, eq(appointments.serviceId, services.id))
    .innerJoin(customers, eq(appointments.customerId, customers.id))
    .innerJoin(locations, eq(appointments.locationId, locations.id))
    .where(eq(appointments.publicId, publicId))
    .limit(1);

  return rows[0] ?? null;
}

export const bookingRouter = router({
  create: publicProcedure.input(createBookingSchema).mutation(async ({ input }) => {
    const { appointment, plan } = await createBooking(input);

    // Si la reserva queda esperando pago todavía puede evaporarse en 15
    // minutos: el lead se marca "convertido" recién cuando el pago se
    // aprueba (ver payments.ts). Sin pago de por medio, tomar la hora ya es
    // el cierre del embudo.
    if (!plan.required) {
      await db
        .update(leads)
        .set({ convertedAt: new Date() })
        .where(and(eq(leads.email, input.customer.email), isNull(leads.convertedAt)));
    }

    return {
      publicId: appointment.publicId,
      status: appointment.status,
      startsAt: appointment.startsAt,
      cancelToken: appointment.cancelToken,
      payment: plan.required
        ? {
            depositClp: plan.depositClp,
            fullClp: plan.fullClp,
            holdExpiresAt: new Date(appointment.createdAt.getTime() + HOLD_TIMEOUT_MS),
          }
        : null,
    };
  }),

  getByPublicId: publicProcedure.input(bookingLookupSchema).query(async ({ input }) => {
    const booking = await loadPublicBooking(input.publicId);
    if (!booking) return null;

    // El token no se devuelve: quien tiene el enlace ya lo trae, y publicarlo
    // permitiría cancelar a cualquiera que conozca el publicId.
    const { cancelToken: _cancelToken, customerEmail: _email, ...rest } = booking;
    return rest;
  }),

  cancel: publicProcedure.input(cancelBookingSchema).mutation(async ({ input }) => {
    const booking = await loadPublicBooking(input.publicId);

    if (!booking || booking.cancelToken !== input.cancelToken) {
      throw new TRPCError({
        code: "FORBIDDEN",
        message: "El enlace de cancelación no es válido.",
      });
    }

    if (booking.status === "cancelled") {
      return { status: "cancelled" as const };
    }

    if (booking.status === "completed") {
      throw new TRPCError({
        code: "BAD_REQUEST",
        message: "Esta cita ya se realizó y no puede cancelarse.",
      });
    }

    const [updated] = await db
      .update(appointments)
      .set({ status: "cancelled", updatedAt: new Date() })
      .where(eq(appointments.publicId, input.publicId))
      .returning();

    await dropPendingReminders(updated.id);
    await enqueueNow(updated, "cancelled", booking.customerEmail);

    return { status: "cancelled" as const };
  }),
});

export const leadRouter = router({
  /**
   * Misma persona retomando el embudo: se actualiza su fila en vez de
   * acumular una nueva cada vez que escribe el correo. `serviceId` ausente
   * cuenta como parte de la llave (dos leads sin servicio elegido no
   * colisionan entre sí, así que cada visita sin servicio queda su propia
   * fila — es una limitación aceptada, no un bug).
   */
  capture: publicProcedure.input(leadCaptureSchema).mutation(async ({ input }) => {
    await db
      .insert(leads)
      .values({
        email: input.email,
        name: input.name,
        phone: input.phone,
        serviceId: input.serviceId,
        step: input.step,
      })
      .onConflictDoUpdate({
        target: [leads.email, leads.serviceId],
        set: {
          name: sql`coalesce(${input.name ?? null}, ${leads.name})`,
          phone: sql`coalesce(${input.phone ?? null}, ${leads.phone})`,
          step: input.step,
        },
      });
    return { ok: true } as const;
  }),

  contact: publicProcedure.input(contactFormSchema).mutation(async ({ input, ctx }) => {
    // Campo trampa: un bot lo rellena, una persona nunca lo ve. Se responde
    // éxito igual para no delatar el mecanismo.
    if (input.honeypot) return { ok: true } as const;

    const ip = clientIp(ctx.req);
    if (isRateLimited(`contact:${ip}`, 5, 10 * 60_000)) {
      throw new TRPCError({
        code: "TOO_MANY_REQUESTS",
        message: "Enviaste varios mensajes seguidos. Intenta de nuevo en unos minutos.",
      });
    }

    await db
      .insert(leads)
      .values({
        email: input.email,
        name: input.name,
        phone: input.phone,
        serviceId: input.serviceId,
        step: "contacto",
      })
      .onConflictDoUpdate({
        target: [leads.email, leads.serviceId],
        set: { name: input.name, phone: sql`coalesce(${input.phone ?? null}, ${leads.phone})`, step: "contacto" },
      });

    if (ENV.adminNotifyEmail) {
      const contactLine = input.phone ? `${input.email} · ${input.phone}` : input.email;
      await enqueueManualMessage(
        ENV.adminNotifyEmail,
        `Nuevo mensaje de contacto · ${input.name}`,
        `${input.name} (${contactLine}) escribió desde /contacto:\n\n${input.message}`,
      );
    }

    return { ok: true } as const;
  }),
});
