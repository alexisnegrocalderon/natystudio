import { ENV } from "../env";
import { router, publicProcedure } from "../trpc";
import { adminRouter } from "./admin";
import { authRouter } from "./auth";
import { availabilityRouter, bookingRouter, leadRouter } from "./booking";
import { catalogRouter } from "./catalog";
import { contentRouter } from "./content";

export const appRouter = router({
  /** Bandera que el frontend consulta para saber si mostrar el paso de pago. */
  config: publicProcedure.query(() => ({
    paymentsEnabled: ENV.paymentsEnabled,
    mercadoPagoPublicKey: ENV.paymentsEnabled ? ENV.mercadoPago.publicKey : "",
  })),

  catalog: catalogRouter,
  availability: availabilityRouter,
  booking: bookingRouter,
  lead: leadRouter,
  content: contentRouter,
  auth: authRouter,
  admin: adminRouter,
});

export type AppRouter = typeof appRouter;
