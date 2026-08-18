import { getNataliaAdminSession, parsePortalCookie } from "./nataliaAdmin";
import { confirmSimulatedBooking, countNataliaBookings, getPublicBookingBrickConfig, holdPublicAvailability, listNataliaBookings, listPublicAvailability, processPublicBookingBrickPayment } from "./nataliaBooking";

type RequestLike = { method?: string; body?: unknown; headers?: { cookie?: string }; query?: Record<string, unknown> };
type ResponseLike = { status(code: number): ResponseLike; json(body: unknown): void };

function bodyObject(body: unknown) {
  if (typeof body === "string") { try { return JSON.parse(body) as Record<string, unknown>; } catch { return {}; } }
  return typeof body === "object" && body ? body as Record<string, unknown> : {};
}

function fail(res: ResponseLike, error: unknown) {
  return res.status(400).json({ error: error instanceof Error ? error.message : "No fue posible completar la reserva." });
}

export async function listPublicSlots(req: RequestLike, res: ResponseLike) {
  if (req.method !== "GET") return res.status(405).json({ error: "method_not_allowed" });
  try { return res.status(200).json({ slots: await listPublicAvailability() }); } catch (error) { return fail(res, error); }
}

export async function holdPublicSlot(req: RequestLike, res: ResponseLike) {
  if (req.method !== "POST") return res.status(405).json({ error: "method_not_allowed" });
  try { return res.status(200).json({ hold: await holdPublicAvailability({ slotId: Number(bodyObject(req.body).slotId) }) }); } catch (error) { return fail(res, error); }
}

export async function createPublicBooking(req: RequestLike, res: ResponseLike) {
  if (req.method !== "POST") return res.status(405).json({ error: "method_not_allowed" });
  try { return res.status(201).json({ booking: await confirmSimulatedBooking(bodyObject(req.body) as any) }); } catch (error) { return fail(res, error); }
}

export async function getPublicBookingPaymentConfig(req: RequestLike, res: ResponseLike) {
  if (req.method !== "POST") return res.status(405).json({ error: "method_not_allowed" });
  try { return res.status(200).json({ payment: await getPublicBookingBrickConfig(Number(bodyObject(req.body).bookingId)) }); } catch (error) { return fail(res, error); }
}

export async function submitPublicBookingBrickPayment(req: RequestLike, res: ResponseLike) {
  if (req.method !== "POST") return res.status(405).json({ error: "method_not_allowed" });
  try { return res.status(201).json({ payment: await processPublicBookingBrickPayment(bodyObject(req.body) as any) }); } catch (error) { return fail(res, error); }
}

export async function listAdminBookings(req: RequestLike, res: ResponseLike) {
  if (req.method !== "GET") return res.status(405).json({ error: "method_not_allowed" });
  const user = await getNataliaAdminSession(parsePortalCookie(req.headers?.cookie));
  if (!user) return res.status(401).json({ error: "unauthorized" });
  const limit = Number(req.query?.limit ?? 50);
  const offset = Number(req.query?.offset ?? 0);
  try {
    const [bookings, total] = await Promise.all([listNataliaBookings({ limit, offset }), countNataliaBookings()]);
    return res.status(200).json({ bookings, total, limit: Math.min(Math.max(Math.floor(limit || 50), 1), 100), offset: Math.max(Math.floor(offset || 0), 0) });
  } catch (error) { return fail(res, error); }
}

export function registerNataliaBookingRoutes(app: { get(path: string, handler: any): void; post(path: string, handler: any): void }) {
  app.get("/api/slots", listPublicSlots);
  app.post("/api/slots/hold", holdPublicSlot);
  app.post("/api/bookings", createPublicBooking);
  app.post("/api/bookings/payment-config", getPublicBookingPaymentConfig);
  app.post("/api/bookings/payment", submitPublicBookingBrickPayment);
  app.get("/api/admin/bookings", listAdminBookings);
}
