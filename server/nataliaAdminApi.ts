import type { Express } from "express";
import { createNataliaAdminSession, getNataliaAdminSession, parsePortalCookie, portalSessionCookie, revokeNataliaAdminSession } from "./nataliaAdmin";
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
  const user = await getNataliaAdminSession(sessionToken(req));
  if (!user) return res.status(401).json({ error: "unauthorized" });
  return res.status(200).json({ user });
}

export async function nataliaAdminDashboard(req: RequestLike, res: ResponseLike) {
  const user = await getNataliaAdminSession(sessionToken(req));
  if (!user) return res.status(401).json({ error: "unauthorized" });
  const [overview, services] = await Promise.all([getPilotOverview(), listPilotServices()]);
  return res.status(200).json({ overview, services });
}

export function registerNataliaAdminRoutes(app: Express) {
  app.post("/api/admin/login", loginNataliaAdmin);
  app.post("/api/admin/logout", logoutNataliaAdmin);
  app.get("/api/admin/me", nataliaAdminMe);
  app.get("/api/admin/dashboard", nataliaAdminDashboard);
}
