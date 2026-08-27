import { TRPCError } from "@trpc/server";
import { eq } from "drizzle-orm";
import { nanoid } from "nanoid";
import type { CreateBookingInput } from "@naty/shared";
import { generateToken } from "../auth/session";
import { ENV } from "../env";
import { db, appointments, appointmentServices, customers, type Appointment } from "../db";
import { enqueueBookingEmails } from "./email";
import { resolvePaymentPlan, type PaymentPlan } from "./payments";
import { combinedDuration, getSettings, isSlotAvailable, loadActiveServices } from "./scheduling";

/** Código de PostgreSQL para la violación de un constraint de exclusión. */
const EXCLUSION_VIOLATION = "23P01";

function isExclusionViolation(error: unknown): boolean {
  return typeof error === "object" && error !== null && (error as { code?: string }).code === EXCLUSION_VIOLATION;
}

const SLOT_TAKEN = new TRPCError({
  code: "CONFLICT",
  message: "Ese horario acaba de ser reservado. Elige otro, por favor.",
});

export async function createBooking(
  input: CreateBookingInput,
): Promise<{ appointment: Appointment; plan: PaymentPlan }> {
  // Se cargan en el orden pedido: el primero es el "servicio principal" que
  // queda en appointments.serviceId (ver comentario en schema.ts).
  const rows = await loadActiveServices(input.serviceIds);
  if (!rows) {
    throw new TRPCError({ code: "NOT_FOUND", message: "Alguno de los servicios elegidos no está disponible." });
  }
  const orderedServices = input.serviceIds.map(id => rows.find(row => row.id === id)!);
  const primaryService = orderedServices[0];

  const startsAt = new Date(input.startsAt);
  if (Number.isNaN(startsAt.getTime())) {
    throw new TRPCError({ code: "BAD_REQUEST", message: "La fecha de la reserva no es válida." });
  }

  if (!(await isSlotAvailable(input.serviceIds, input.locationId, startsAt))) {
    throw SLOT_TAKEN;
  }

  const settings = await getSettings();
  const { durationMin, bufferMin } = combinedDuration(orderedServices);
  const endsAt = new Date(startsAt.getTime() + durationMin * 60_000);
  const blockedUntil = new Date(endsAt.getTime() + bufferMin * 60_000);

  const totalPriceClp = orderedServices.reduce((sum, service) => sum + service.priceClp, 0);
  const plan = resolvePaymentPlan(
    orderedServices.map(service => ({ priceClp: service.priceClp, depositPercent: service.depositPercent })),
    ENV.paymentsEnabled,
  );

  const appointment = await db.transaction(async tx => {
    // Una misma persona vuelve: se reutiliza su ficha y se actualizan sus datos.
    const [customer] = await tx
      .insert(customers)
      .values({
        email: input.customer.email,
        name: input.customer.name,
        phone: input.customer.phone,
      })
      .onConflictDoUpdate({
        target: customers.email,
        set: {
          name: input.customer.name,
          phone: input.customer.phone,
          updatedAt: new Date(),
        },
      })
      .returning();

    try {
      const [created] = await tx
        .insert(appointments)
        .values({
          publicId: nanoid(12),
          customerId: customer.id,
          serviceId: primaryService.id,
          locationId: input.locationId,
          startsAt,
          endsAt,
          blockedUntil,
          // Con pago requerido la hora queda retenida hasta que se pague (o
          // vence en 15 minutos). Si no, el flujo de siempre: Naty confirma a
          // mano, salvo que la aprobación automática esté activada.
          status: plan.required ? "pending_payment" : settings.autoApprove ? "confirmed" : "pending_approval",
          priceClp: totalPriceClp,
          cancelToken: generateToken(),
          customerNotes: input.customer.notes,
        })
        .returning();

      await tx.insert(appointmentServices).values(
        orderedServices.map(service => ({
          appointmentId: created.id,
          serviceId: service.id,
          priceClp: service.priceClp,
          depositPercent: service.depositPercent,
          durationMin: service.durationMin,
          bufferMin: service.bufferMin,
        })),
      );

      return created;
    } catch (error) {
      // El constraint `appointments_no_overlap` es la última palabra: si dos
      // reservas llegan a la vez, la base rechaza la segunda aunque ambas hayan
      // pasado la comprobación previa de disponibilidad.
      if (isExclusionViolation(error)) throw SLOT_TAKEN;
      throw error;
    }
  });

  await enqueueBookingEmails(appointment, {
    email: input.customer.email,
    name: input.customer.name,
  });

  return { appointment, plan };
}

export async function rescheduleAppointment(id: number, startsAt: Date): Promise<Appointment> {
  const rows = await db.select().from(appointments).where(eq(appointments.id, id)).limit(1);
  const appointment = rows[0];
  if (!appointment) {
    throw new TRPCError({ code: "NOT_FOUND", message: "La cita no existe." });
  }

  const items = await db
    .select({ durationMin: appointmentServices.durationMin, bufferMin: appointmentServices.bufferMin })
    .from(appointmentServices)
    .where(eq(appointmentServices.appointmentId, appointment.id));
  if (items.length === 0) {
    throw new TRPCError({ code: "NOT_FOUND", message: "El servicio de la cita ya no existe." });
  }

  const { durationMin, bufferMin } = combinedDuration(items);
  const endsAt = new Date(startsAt.getTime() + durationMin * 60_000);
  const blockedUntil = new Date(endsAt.getTime() + bufferMin * 60_000);

  try {
    const [updated] = await db
      .update(appointments)
      .set({ startsAt, endsAt, blockedUntil, updatedAt: new Date() })
      .where(eq(appointments.id, id))
      .returning();
    return updated;
  } catch (error) {
    if (isExclusionViolation(error)) throw SLOT_TAKEN;
    throw error;
  }
}
