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
