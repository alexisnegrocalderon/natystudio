import type { Express } from "express";
import { createNataliaAdminSession, getNataliaAdminSession, parsePortalCookie, portalSessionCookie, revokeNataliaAdminSession } from "./nataliaAdmin";
import { createNataliaAvailability, createNataliaCourse, listNataliaAvailability, listNataliaCourses, updateNataliaService } from "./nataliaAdmin";
import { countNataliaBookings, listNataliaBookings } from "./nataliaBooking";
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
  const [overview, services, availability, courses, bookings, bookingsTotal] = await Promise.all([getPilotOverview(), listPilotServices(), listNataliaAvailability(), listNataliaCourses(), listNataliaBookings({ limit: 50 }), countNataliaBookings()]);
  return res.status(200).json({ overview, services, availability, courses, bookings, bookingsTotal });
}

export async function saveNataliaService(req: RequestLike, res: ResponseLike) {
  if (req.method !== "POST") return res.status(405).json({ error: "method_not_allowed" });
  if (!(await requireNataliaAdmin(req, res))) return;
  try {
    return res.status(200).json({ service: await updateNataliaService(bodyObject(req.body) as any) });
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
    return res.status(201).json({ course: await createNataliaCourse(bodyObject(req.body) as any) });
  } catch (error) {
    return res.status(400).json({ error: error instanceof Error ? error.message : "No fue posible guardar el curso." });
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
  app.get("/api/admin/payments/mercadopago", getNataliaPaymentConnection);
  app.post("/api/admin/payments/mercadopago/connect", startNataliaPaymentConnection);
}
