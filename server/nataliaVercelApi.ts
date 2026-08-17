import { neon } from "@neondatabase/serverless";
import {
  addNataliaAvailability,
  addNataliaCourse,
  getNataliaPaymentConnection,
  loginNataliaAdmin,
  logoutNataliaAdmin,
  nataliaAdminDashboard,
  nataliaAdminMe,
  saveNataliaService,
  startNataliaPaymentConnection,
} from "./nataliaAdminApi";
import { createPublicBooking, holdPublicSlot, listAdminBookings, listPublicSlots } from "./nataliaBookingApi";

type ApiRequest = { method?: string; url?: string };
type ApiResponse = {
  setHeader(name: string, value: string): void;
  status(code: number): ApiResponse;
  json(body: unknown): void;
};

type PilotService = {
  slug: string;
  name: string;
  description: string;
  priceNote: string;
  durationNote: string;
};

async function pilotServices(req: ApiRequest, res: ApiResponse) {
  res.setHeader("Cache-Control", "no-store");
  if (req.method !== "GET") return res.status(405).json({ error: "method_not_allowed" });
  const databaseUrl = process.env.NEON_DATABASE_URL;
  if (!databaseUrl) return res.status(503).json({ error: "pilot_database_not_configured" });
  try {
    const sql = neon(databaseUrl);
    const rows = await sql`
      SELECT slug, name, description, price_note AS "priceNote", duration_note AS "durationNote"
      FROM pilot_services WHERE enabled = TRUE ORDER BY id ASC
    `;
    const services: PilotService[] = rows.map((row) => ({
      slug: String(row.slug), name: String(row.name), description: String(row.description),
      priceNote: String(row.priceNote), durationNote: String(row.durationNote),
    }));
    return res.status(200).json({ services });
  } catch {
    return res.status(502).json({ error: "pilot_catalog_unavailable" });
  }
}

function requestPath(req: ApiRequest & { query?: Record<string, string | string[] | undefined> }) {
  const queryPath = req.query?.path ?? new URL(req.url ?? "/api", "https://natalia.local").searchParams.get("path");
  if (typeof queryPath === "string" && queryPath) return `/${queryPath.replace(/^\/+/, "")}`;
  if (Array.isArray(queryPath) && queryPath.length) return `/${queryPath.join("/").replace(/^\/+/, "")}`;
  return new URL(req.url ?? "/api", "https://natalia.local").pathname.replace(/^\/api/, "") || "/";
}

export async function handleNataliaVercelApi(req: any, res: any) {
  const path = requestPath(req);
  if (path === "/health") return res.status(200).json({ service: "natalia-pilot-preview", status: "ready" });
  if (path === "/pilot-services") return pilotServices(req, res);
  if (path === "/slots") return listPublicSlots(req, res);
  if (path === "/slots/hold") return holdPublicSlot(req, res);
  if (path === "/bookings") return createPublicBooking(req, res);
  if (path === "/admin/login") return loginNataliaAdmin(req, res);
  if (path === "/admin/logout") return logoutNataliaAdmin(req, res);
  if (path === "/admin/me") return nataliaAdminMe(req, res);
  if (path === "/admin/dashboard") return nataliaAdminDashboard(req, res);
  if (path === "/admin/services") return saveNataliaService(req, res);
  if (path === "/admin/availability") return addNataliaAvailability(req, res);
  if (path === "/admin/courses") return addNataliaCourse(req, res);
  if (path === "/admin/bookings") return listAdminBookings(req, res);
  if (path === "/admin/payments/mercadopago") {
    return req.method === "GET" ? getNataliaPaymentConnection(req, res) : startNataliaPaymentConnection(req, res);
  }
  return res.status(404).json({ error: "api_route_not_found" });
}
