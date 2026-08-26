import { TRPCError } from "@trpc/server";
import { desc, eq } from "drizzle-orm";
import { bookingLookupSchema, processPaymentSchema } from "@naty/shared";
import { ENV } from "../env";
import { db, appointments, payments } from "../db";
import { processPayment } from "../services/payments";
import { publicProcedure, router } from "../trpc";

export const paymentRouter = router({
  process: publicProcedure.input(processPaymentSchema).mutation(async ({ input }) => {
    if (!ENV.paymentsEnabled) {
      throw new TRPCError({ code: "PRECONDITION_FAILED", message: "Los pagos en línea no están disponibles." });
    }
    return processPayment(input);
  }),

  /** Sondeo mientras un pago queda "in_process": el webhook lo resuelve en paralelo. */
  status: publicProcedure.input(bookingLookupSchema).query(async ({ input }) => {
    const [appointment] = await db
      .select({ id: appointments.id, status: appointments.status, amountPaidClp: appointments.amountPaidClp })
      .from(appointments)
      .where(eq(appointments.publicId, input.publicId))
      .limit(1);

    if (!appointment) return null;

    const [latestPayment] = await db
      .select({ status: payments.status })
      .from(payments)
      .where(eq(payments.appointmentId, appointment.id))
      .orderBy(desc(payments.id))
      .limit(1);

    return {
      appointmentStatus: appointment.status,
      amountPaidClp: appointment.amountPaidClp,
      latestPaymentStatus: latestPayment?.status ?? null,
    };
  }),
});
