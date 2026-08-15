import { createExpressMiddleware } from "@trpc/server/adapters/express";
import cors from "cors";
import { eq } from "drizzle-orm";
import express from "express";
import { createContext } from "./context";
import { db, appointments, customers, services } from "./db";
import { ENV } from "./env";
import { appRouter } from "./routers";
import { startScheduler } from "./scheduler";
import { buildIcs } from "./services/calendar";

const app = express();

app.disable("x-powered-by");
app.use(express.json({ limit: "2mb" }));

/**
 * El sitio (Vercel) y el API (Railway) viven en dominios distintos, así que el
 * navegador exige CORS explícito. La allowlist se configura por entorno: un
 * `origin: true` reflejaría cualquier origen y anularía la protección, que
 * importa porque las peticiones del panel viajan con cookie de sesión.
 */
app.use(
  cors({
    origin(origin, callback) {
      // Sin cabecera Origin (curl, health checks del hosting) no hay nada que proteger.
      if (!origin) return callback(null, true);
      if (ENV.webOrigins.includes(origin.replace(/\/$/, ""))) return callback(null, true);
      callback(new Error(`Origen no autorizado: ${origin}`));
    },
    credentials: true,
  }),
);

app.get("/health", (_req, res) => {
  res.json({ ok: true, paymentsEnabled: ENV.paymentsEnabled });
});

/**
 * Archivo de calendario de una cita. Va fuera de tRPC porque el navegador debe
 * poder descargarlo con una petición GET normal desde el correo o el sitio.
 */
app.get("/api/calendar/:publicId.ics", async (req, res) => {
  const publicId = req.params.publicId;

  const rows = await db
    .select({ appointment: appointments, service: services, customer: customers })
    .from(appointments)
    .innerJoin(services, eq(appointments.serviceId, services.id))
    .innerJoin(customers, eq(appointments.customerId, customers.id))
    .where(eq(appointments.publicId, publicId))
    .limit(1);

  const found = rows[0];
  if (!found) {
    res.status(404).json({ error: "La reserva no existe." });
    return;
  }

  const ics = buildIcs({
    uid: `${found.appointment.publicId}@naty.studio`,
    startsAt: found.appointment.startsAt,
    endsAt: found.appointment.endsAt,
    title: `${found.service.name} · naty.studio`,
    description: "Tu cita en naty.studio, Valparaíso.",
    location: "Valparaíso, Chile",
    url: `${ENV.siteUrl}/reserva/${found.appointment.publicId}`,
    cancelled: found.appointment.status === "cancelled",
  });

  res.setHeader("Content-Type", "text/calendar; charset=utf-8");
  res.setHeader("Content-Disposition", `attachment; filename="cita-naty-studio.ics"`);
  res.send(ics);
});

app.use("/api/trpc", createExpressMiddleware({ router: appRouter, createContext }));

app.listen(ENV.port, () => {
  console.info(`[api] escuchando en http://localhost:${ENV.port}`);
  console.info(`[api] orígenes permitidos: ${ENV.webOrigins.join(", ")}`);
  if (!ENV.paymentsEnabled) {
    console.info("[api] pagos desactivados — las reservas quedan pendientes de aprobación");
  }
  startScheduler();
});
