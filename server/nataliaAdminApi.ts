import type { Express } from "express";
import { createNataliaAdminSession, getNataliaAdminSession, parsePortalCookie, portalSessionCookie, revokeNataliaAdminSession } from "./nataliaAdmin";
import { createNataliaAvailability, createNataliaCourse, createNataliaScheduleException, createNataliaWeeklyScheduleRule, deleteNataliaScheduleException, deleteNataliaWeeklyScheduleRule, listNataliaAdminServices, listNataliaAvailability, listNataliaCourses, listNataliaScheduleExceptions, listNataliaSiteContent, listNataliaWeeklySchedule, saveNataliaCourse, saveNataliaService as saveNataliaServiceRecord, saveNataliaSiteContent, updateNataliaBookingStatus } from "./nataliaAdmin";
import { countNataliaBookings, listNataliaBookings, syncNataliaBookingPayment } from "./nataliaBooking";
import { getNataliaMercadoPagoConnectionStatus, startNataliaMercadoPagoConnection } from "./ancPaymentBridge";
import { getPilotOverview, listPilotServices } from "./nataliaPilot";

type RequestLike = { method?: string; body?: unknown; headers?: { cookie?: string } };
type ResponseLike = { setHeader(name: string, value: string): void; status(code: number): ResponseLike; json(body: unknown): void };

function bodyObject(body: unknown) {
  if (typeof body === "string") {
    try { return JSON.parse(body) as Record<string, unknown>; } catch { return {}; }
  }
  return typeof body === "object" && body ? body as Record<string, unknown> : {};
}

function sessionToken(req: RequestLike) {
  return parsePortalCookie(req.headers?.cookie);
}

async function requireNataliaAdmin(req: RequestLike, res: ResponseLike) {
  const user = await getNataliaAdminSession(sessionToken(req));
  if (!user) {
    res.status(401).json({ error: "unauthorized" });
    return null;
  }
  return user;
}

export async function loginNataliaAdmin(req: RequestLike, res: ResponseLike) {
  if (req.method !== "POST") return res.status(405).json({ error: "method_not_allowed" });
  const body = bodyObject(req.body);
  const email = typeof body.email === "string" ? body.email : "";
  const password = typeof body.password === "string" ? body.password : "";
  const session = await createNataliaAdminSession(email, password);
  if (!session) return res.status(401).json({ error: "invalid_credentials" });
  res.setHeader("Set-Cookie", portalSessionCookie(session.token));
  return res.status(200).json({ user: session.user });
}

export async function logoutNataliaAdmin(req: RequestLike, res: ResponseLike) {
  if (req.method !== "POST") return res.status(405).json({ error: "method_not_allowed" });
  await revokeNataliaAdminSession(sessionToken(req));
  res.setHeader("Set-Cookie", portalSessionCookie("", 0));
  return res.status(200).json({ success: true });
}

export async function nataliaAdminMe(req: RequestLike, res: ResponseLike) {
  const user = await requireNataliaAdmin(req, res);
  if (!user) return;
  return res.status(200).json({ user });
}

export async function nataliaAdminDashboard(req: RequestLike, res: ResponseLike) {
  const user = await requireNataliaAdmin(req, res);
  if (!user) return;
  const [overview, services, availability, courses, bookings, bookingsTotal, weeklySchedule, scheduleExceptions, siteContent] = await Promise.all([
    getPilotOverview(), listNataliaAdminServices(), listNataliaAvailability(), listNataliaCourses(), listNataliaBookings({ limit: 50 }), countNataliaBookings(),
    listNataliaWeeklySchedule(), listNataliaScheduleExceptions(), listNataliaSiteContent(),
  ]);
  return res.status(200).json({ overview, services, availability, courses, bookings, bookingsTotal, weeklySchedule, scheduleExceptions, siteContent });
}

export async function saveNataliaService(req: RequestLike, res: ResponseLike) {
  if (req.method !== "POST") return res.status(405).json({ error: "method_not_allowed" });
  if (!(await requireNataliaAdmin(req, res))) return;
  try {
    return res.status(200).json({ service: await saveNataliaServiceRecord(bodyObject(req.body) as any) });
  } catch (error) {
    return res.status(400).json({ error: error instanceof Error ? error.message : "No fue posible guardar el servicio." });
  }
}

export async function addNataliaAvailability(req: RequestLike, res: ResponseLike) {
  if (req.method !== "POST") return res.status(405).json({ error: "method_not_allowed" });
  if (!(await requireNataliaAdmin(req, res))) return;
  try {
    return res.status(201).json({ slot: await createNataliaAvailability(bodyObject(req.body) as any) });
  } catch (error) {
    return res.status(400).json({ error: error instanceof Error ? error.message : "No fue posible guardar el horario." });
  }
}

export async function addNataliaCourse(req: RequestLike, res: ResponseLike) {
  if (req.method !== "POST") return res.status(405).json({ error: "method_not_allowed" });
  if (!(await requireNataliaAdmin(req, res))) return;
  try {
    const body = bodyObject(req.body);
    const course = body.id ? await saveNataliaCourse(body as any) : await createNataliaCourse(body as any);
    return res.status(201).json({ course });
  } catch (error) {
    return res.status(400).json({ error: error instanceof Error ? error.message : "No fue posible guardar el curso." });
  }
}

export async function addNataliaWeeklyScheduleRule(req: RequestLike, res: ResponseLike) {
  if (req.method !== "POST") return res.status(405).json({ error: "method_not_allowed" });
  if (!(await requireNataliaAdmin(req, res))) return;
  try {
    return res.status(201).json({ rule: await createNataliaWeeklyScheduleRule(bodyObject(req.body) as any) });
  } catch (error) {
    return res.status(400).json({ error: error instanceof Error ? error.message : "No fue posible guardar la regla de agenda." });
  }
}

export async function removeNataliaWeeklyScheduleRule(req: RequestLike, res: ResponseLike) {
  if (req.method !== "POST") return res.status(405).json({ error: "method_not_allowed" });
  if (!(await requireNataliaAdmin(req, res))) return;
  try {
    return res.status(200).json(await deleteNataliaWeeklyScheduleRule(Number(bodyObject(req.body).id)));
  } catch (error) {
    return res.status(400).json({ error: error instanceof Error ? error.message : "No fue posible eliminar la regla de agenda." });
  }
}

export async function addNataliaScheduleException(req: RequestLike, res: ResponseLike) {
  if (req.method !== "POST") return res.status(405).json({ error: "method_not_allowed" });
  if (!(await requireNataliaAdmin(req, res))) return;
  try {
    return res.status(201).json({ exception: await createNataliaScheduleException(bodyObject(req.body) as any) });
  } catch (error) {
    return res.status(400).json({ error: error instanceof Error ? error.message : "No fue posible guardar la excepción." });
  }
}

export async function removeNataliaScheduleException(req: RequestLike, res: ResponseLike) {
  if (req.method !== "POST") return res.status(405).json({ error: "method_not_allowed" });
  if (!(await requireNataliaAdmin(req, res))) return;
  try {
    return res.status(200).json(await deleteNataliaScheduleException(Number(bodyObject(req.body).id)));
  } catch (error) {
    return res.status(400).json({ error: error instanceof Error ? error.message : "No fue posible eliminar la excepción." });
  }
}

export async function saveNataliaContent(req: RequestLike, res: ResponseLike) {
  if (req.method !== "POST") return res.status(405).json({ error: "method_not_allowed" });
  const user = await requireNataliaAdmin(req, res);
  if (!user) return;
  try {
    const body = bodyObject(req.body);
    return res.status(200).json({ content: await saveNataliaSiteContent({ contentKey: String(body.contentKey ?? ""), contentValue: body.contentValue, publish: Boolean(body.publish), adminId: user.id }) });
  } catch (error) {
    return res.status(400).json({ error: error instanceof Error ? error.message : "No fue posible guardar el contenido." });
  }
}

export async function changeNataliaBookingStatus(req: RequestLike, res: ResponseLike) {
  if (req.method !== "POST") return res.status(405).json({ error: "method_not_allowed" });
  const user = await requireNataliaAdmin(req, res);
  if (!user) return;
  try {
    const body = bodyObject(req.body);
    return res.status(200).json({ booking: await updateNataliaBookingStatus({ bookingId: Number(body.bookingId), status: String(body.status) as any, note: typeof body.note === "string" ? body.note : undefined, adminId: user.id }) });
  } catch (error) {
    return res.status(400).json({ error: error instanceof Error ? error.message : "No fue posible actualizar la reserva." });
  }
}

export async function syncNataliaBookingPaymentStatus(req: RequestLike, res: ResponseLike) {
  if (req.method !== "POST") return res.status(405).json({ error: "method_not_allowed" });
  if (!(await requireNataliaAdmin(req, res))) return;
  try {
    const body = bodyObject(req.body);
    return res.status(200).json({ result: await syncNataliaBookingPayment(Number(body.bookingId)) });
  } catch (error) {
    return res.status(400).json({ error: error instanceof Error ? error.message : "No fue posible sincronizar el pago." });
  }
}

export async function getNataliaPaymentConnection(req: RequestLike, res: ResponseLike) {
  if (req.method !== "GET") return res.status(405).json({ error: "method_not_allowed" });
  if (!(await requireNataliaAdmin(req, res))) return;
  try {
    return res.status(200).json(await getNataliaMercadoPagoConnectionStatus());
  } catch (error) {
    return res.status(503).json({ error: error instanceof Error ? error.message : "No fue posible consultar la conexión de pagos." });
  }
}

export async function startNataliaPaymentConnection(req: RequestLike, res: ResponseLike) {
  if (req.method !== "POST") return res.status(405).json({ error: "method_not_allowed" });
  if (!(await requireNataliaAdmin(req, res))) return;
  try {
    return res.status(200).json(await startNataliaMercadoPagoConnection());
  } catch (error) {
    return res.status(503).json({ error: error instanceof Error ? error.message : "No fue posible iniciar la conexión de pagos." });
  }
}

export function registerNataliaAdminRoutes(app: Express) {
  app.post("/api/admin/login", loginNataliaAdmin);
  app.post("/api/admin/logout", logoutNataliaAdmin);
  app.get("/api/admin/me", nataliaAdminMe);
  app.get("/api/admin/dashboard", nataliaAdminDashboard);
  app.post("/api/admin/services", saveNataliaService);
  app.post("/api/admin/availability", addNataliaAvailability);
  app.post("/api/admin/courses", addNataliaCourse);
  app.post("/api/admin/schedule/rules", addNataliaWeeklyScheduleRule);
  app.post("/api/admin/schedule/rules/delete", removeNataliaWeeklyScheduleRule);
  app.post("/api/admin/schedule/exceptions", addNataliaScheduleException);
  app.post("/api/admin/schedule/exceptions/delete", removeNataliaScheduleException);
  app.post("/api/admin/content", saveNataliaContent);
  app.post("/api/admin/bookings/status", changeNataliaBookingStatus);
  app.post("/api/admin/bookings/payment-sync", syncNataliaBookingPaymentStatus);
  app.get("/api/admin/payments/mercadopago", getNataliaPaymentConnection);
  app.post("/api/admin/payments/mercadopago/connect", startNataliaPaymentConnection);
}
