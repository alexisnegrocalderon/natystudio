import { neon } from "@neondatabase/serverless";
import {
  addNataliaScheduleException,
  addNataliaWeeklyScheduleRule,
  addNataliaAvailability,
  addNataliaCourse,
  changeNataliaBookingStatus,
  getNataliaPaymentConnection,
  loginNataliaAdmin,
  logoutNataliaAdmin,
  nataliaAdminDashboard,
  nataliaAdminMe,
  removeNataliaScheduleException,
  removeNataliaWeeklyScheduleRule,
  saveNataliaService,
  saveNataliaContent,
  startNataliaPaymentConnection,
  syncNataliaBookingPaymentStatus,
} from "./nataliaAdminApi";
import { createPublicBooking, getPublicBookingPaymentConfig, holdPublicSlot, listAdminBookings, listPublicSlots, submitPublicBookingBrickPayment } from "./nataliaBookingApi";

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

async function pilotLandingContent(req: ApiRequest, res: ApiResponse) {
  res.setHeader("Cache-Control", "no-store");
  if (req.method !== "GET") return res.status(405).json({ error: "method_not_allowed" });
  const databaseUrl = process.env.NEON_DATABASE_URL;
  if (!databaseUrl) return res.status(503).json({ error: "pilot_database_not_configured" });
  try {
    const sql = neon(databaseUrl);
    const [content] = await sql`
      SELECT content_value AS "contentValue", updated_at AS "updatedAt"
      FROM pilot_site_content
      WHERE content_key = ${"landing.copy"} AND publication_status = ${"published"}
      LIMIT 1
    `;
    return res.status(200).json({ content: content?.contentValue ?? null, updatedAt: content?.updatedAt ?? null });
  } catch {
    return res.status(502).json({ error: "pilot_content_unavailable" });
  }
}

async function publicNataliaAsset(req: ApiRequest, res: any, path: string) {
  if (req.method !== "GET") return res.status(405).json({ error: "method_not_allowed" });
  const key = path.replace(/^\/storage\/+/, "");
  if (!/^natalia-[a-z0-9._-]+$/i.test(key)) {
    return res.status(400).json({ error: "asset_not_allowed" });
  }

  const forgeApiUrl = process.env.BUILT_IN_FORGE_API_URL;
  const forgeApiKey = process.env.BUILT_IN_FORGE_API_KEY;
  if (!forgeApiUrl || !forgeApiKey) return res.status(503).json({ error: "storage_proxy_not_configured" });

  try {
    const forgeUrl = new URL("v1/storage/presign/get", `${forgeApiUrl.replace(/\/+$/, "")}/`);
    forgeUrl.searchParams.set("path", key);
    const storageResponse = await fetch(forgeUrl, { headers: { Authorization: `Bearer ${forgeApiKey}` } });
    if (!storageResponse.ok) return res.status(502).json({ error: "storage_backend_error" });
    const { url } = await storageResponse.json() as { url?: string };
    if (!url) return res.status(502).json({ error: "storage_url_unavailable" });
    res.setHeader("Location", url);
    res.setHeader("Cache-Control", "public, max-age=300, s-maxage=300");
    res.status(307);
    return res.end();
  } catch {
    return res.status(502).json({ error: "storage_proxy_error" });
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
  if (path.startsWith("/storage/")) return publicNataliaAsset(req, res, path);
  if (path === "/pilot-services") return pilotServices(req, res);
  if (path === "/landing-content") return pilotLandingContent(req, res);
  if (path === "/slots") return listPublicSlots(req, res);
  if (path === "/slots/hold") return holdPublicSlot(req, res);
  if (path === "/bookings") return createPublicBooking(req, res);
  if (path === "/bookings/payment-config") return getPublicBookingPaymentConfig(req, res);
  if (path === "/bookings/payment") return submitPublicBookingBrickPayment(req, res);
  if (path === "/admin/login") return loginNataliaAdmin(req, res);
  if (path === "/admin/logout") return logoutNataliaAdmin(req, res);
  if (path === "/admin/me") return nataliaAdminMe(req, res);
  if (path === "/admin/dashboard") return nataliaAdminDashboard(req, res);
  if (path === "/admin/services") return saveNataliaService(req, res);
  if (path === "/admin/availability") return addNataliaAvailability(req, res);
  if (path === "/admin/courses") return addNataliaCourse(req, res);
  if (path === "/admin/schedule/rules") return addNataliaWeeklyScheduleRule(req, res);
  if (path === "/admin/schedule/rules/delete") return removeNataliaWeeklyScheduleRule(req, res);
  if (path === "/admin/schedule/exceptions") return addNataliaScheduleException(req, res);
  if (path === "/admin/schedule/exceptions/delete") return removeNataliaScheduleException(req, res);
  if (path === "/admin/content") return saveNataliaContent(req, res);
  if (path === "/admin/bookings") return listAdminBookings(req, res);
  if (path === "/admin/bookings/status") return changeNataliaBookingStatus(req, res);
  if (path === "/admin/bookings/payment-sync") return syncNataliaBookingPaymentStatus(req, res);
  if (path === "/admin/payments/mercadopago") {
    return req.method === "GET" ? getNataliaPaymentConnection(req, res) : startNataliaPaymentConnection(req, res);
  }
  if (path === "/admin/payments/mercadopago/connect") return startNataliaPaymentConnection(req, res);
  return res.status(404).json({ error: "api_route_not_found" });
}
