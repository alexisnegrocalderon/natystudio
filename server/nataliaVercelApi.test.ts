import { describe, expect, it, vi } from "vitest";
import { handleNataliaVercelApi } from "./nataliaVercelApi";

function response() {
  const res = { setHeader: vi.fn(), status: vi.fn(), json: vi.fn() };
  res.status.mockReturnValue(res);
  return res;
}

describe("handleNataliaVercelApi", () => {
  it("conserva la ruta de salud en el enrutador consolidado", async () => {
    const res = response();
    await handleNataliaVercelApi({ method: "GET", url: "/api/health" }, res);
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({ service: "natalia-pilot-preview", status: "ready" });
  });

  it("acepta el path reescrito por la única función de Vercel", async () => {
    const res = response();
    await handleNataliaVercelApi({ method: "GET", url: "/api?path=health", query: { path: "health" } }, res);
    expect(res.status).toHaveBeenCalledWith(200);
  });

  it("devuelve un error claro para rutas no registradas", async () => {
    const res = response();
    await handleNataliaVercelApi({ method: "GET", url: "/api/no-existe" }, res);
    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith({ error: "api_route_not_found" });
  });

  it("limita el proxy público a los assets editoriales de Natalia", async () => {
    const res = response();
    await handleNataliaVercelApi({ method: "GET", url: "/api?path=storage/otro-proyecto.jpg", query: { path: "storage/otro-proyecto.jpg" } }, res);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ error: "asset_not_allowed" });
  });

  it("reconoce la ruta heredada de conexión Mercado Pago", async () => {
    const res = response();
    await handleNataliaVercelApi({ method: "GET", url: "/api/admin/payments/mercadopago/connect" }, res);
    expect(res.status).toHaveBeenCalledWith(405);
    expect(res.json).toHaveBeenCalledWith({ error: "method_not_allowed" });
  });

  it("reconoce las rutas públicas del Payment Brick sin abrir rutas administrativas", async () => {
    const config = response();
    await handleNataliaVercelApi({ method: "GET", url: "/api/bookings/payment-config" }, config);
    expect(config.status).toHaveBeenCalledWith(405);
    const payment = response();
    await handleNataliaVercelApi({ method: "GET", url: "/api/bookings/payment" }, payment);
    expect(payment.status).toHaveBeenCalledWith(405);
  });

  it("reconoce las rutas públicas de Agenda curada y exige sus métodos correctos", async () => {
    const agenda = response();
    await handleNataliaVercelApi({ method: "POST", url: "/api/agenda" }, agenda);
    expect(agenda.status).toHaveBeenCalledWith(405);
    const waitlist = response();
    await handleNataliaVercelApi({ method: "GET", url: "/api/waitlist" }, waitlist);
    expect(waitlist.status).toHaveBeenCalledWith(405);
  });

  it("mantiene la respuesta segura si falta Neon en el catálogo", async () => {
    const previous = process.env.NEON_DATABASE_URL;
    delete process.env.NEON_DATABASE_URL;
    const res = response();
    await handleNataliaVercelApi({ method: "GET", url: "/api/pilot-services" }, res);
    expect(res.status).toHaveBeenCalledWith(503);
    expect(res.json).toHaveBeenCalledWith({ error: "pilot_database_not_configured" });
    process.env.NEON_DATABASE_URL = previous;
  });
});
