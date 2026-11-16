import { describe, expect, it } from "vitest";
import { absoluteUrl, BUSINESS, whatsappWithMessage } from "./site";

describe("enlaces de captación", () => {
  it("dirige las acciones comerciales al canal de WhatsApp de Naty", () => {
    expect(BUSINESS.whatsapp).toBe("https://wa.me/56988000788");
    expect(whatsappWithMessage("Quiero agendar")).toContain("Quiero%20agendar");
    expect(whatsappWithMessage("Quiero agendar")).toBe("https://wa.me/56988000788?text=Quiero%20agendar");
  });

  it("mantiene el enlace de Instagram en el perfil de la marca", () => {
    expect(BUSINESS.instagram).toBe("https://www.instagram.com/naty.studiovalparaiso/");
  });
});

describe("URLs absolutas", () => {
  it("acepta rutas con y sin barra inicial sin duplicarla", () => {
    expect(absoluteUrl("/servicios")).toMatch(/\/servicios$/);
    expect(absoluteUrl("servicios")).toMatch(/\/servicios$/);
    expect(absoluteUrl("/servicios")).not.toContain("//servicios");
  });
});
