import { TRPCError } from "@trpc/server";
import { and, eq, isNull } from "drizzle-orm";
import {
  availabilityQuerySchema,
  bookingLookupSchema,
  cancelBookingSchema,
  createBookingSchema,
  leadCaptureSchema,
} from "@naty/shared";
import { db, appointments, customers, leads, services } from "../db";
import { createBooking } from "../services/booking";
import { dropPendingReminders, enqueueNow } from "../services/email";
import { getAvailability } from "../services/scheduling";
import { publicProcedure, router } from "../trpc";

export const availabilityRouter = router({
  getSlots: publicProcedure.input(availabilityQuerySchema).query(async ({ input }) => {
    return getAvailability(input.serviceId, input.from, input.to);
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
    })
    .from(appointments)
    .innerJoin(services, eq(appointments.serviceId, services.id))
    .innerJoin(customers, eq(appointments.customerId, customers.id))
    .where(eq(appointments.publicId, publicId))
    .limit(1);

  return rows[0] ?? null;
}

export const bookingRouter = router({
  create: publicProcedure.input(createBookingSchema).mutation(async ({ input }) => {
    const appointment = await createBooking(input);

    // La reserva completada cierra el embudo: se marca el lead para no
    // perseguir a quien ya reservó.
    await db
      .update(leads)
      .set({ convertedAt: new Date() })
      .where(and(eq(leads.email, input.customer.email), isNull(leads.convertedAt)));

    return {
      publicId: appointment.publicId,
      status: appointment.status,
      startsAt: appointment.startsAt,
      cancelToken: appointment.cancelToken,
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
  capture: publicProcedure.input(leadCaptureSchema).mutation(async ({ input }) => {
    await db.insert(leads).values({
      email: input.email,
      name: input.name,
      phone: input.phone,
      serviceId: input.serviceId,
      step: input.step,
    });
    return { ok: true } as const;
  }),
});
