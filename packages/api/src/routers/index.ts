import { ENV } from "../env";
import { getMpConnection } from "../services/mercadopago-connection";
import { router, publicProcedure } from "../trpc";
import { adminRouter } from "./admin";
import { authRouter } from "./auth";
import { availabilityRouter, bookingRouter, leadRouter } from "./booking";
import { catalogRouter } from "./catalog";
import { contentRouter } from "./content";
import { paymentRouter } from "./payment";

export const appRouter = router({
  /**
   * Bandera que el frontend consulta para saber si mostrar el paso de pago.
   * Hacen falta las dos cosas: pagos activados por variable de entorno Y que
   * Naty haya conectado su cuenta de Mercado Pago desde Ajustes.
   */
  config: publicProcedure.query(async () => {
    if (!ENV.paymentsEnabled) return { paymentsEnabled: false, mercadoPagoPublicKey: "" };

    const connection = await getMpConnection();
    // Sin la llave pública de la cuenta conectada no se muestra el paso de
    // pago: tokenizar con la llave de otra cuenta haría fallar cada cobro.
    if (!connection?.sellerPublicKey) return { paymentsEnabled: false, mercadoPagoPublicKey: "" };

    return { paymentsEnabled: true, mercadoPagoPublicKey: connection.sellerPublicKey };
  }),

  catalog: catalogRouter,
  availability: availabilityRouter,
  booking: bookingRouter,
  payment: paymentRouter,
  lead: leadRouter,
  content: contentRouter,
  auth: authRouter,
  admin: adminRouter,
});

export type AppRouter = typeof appRouter;
