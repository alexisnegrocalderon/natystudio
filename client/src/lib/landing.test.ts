import { describe, expect, it } from "vitest";
import { INSTAGRAM_URL, WHATSAPP_URL, whatsappWithMessage } from "./landing";

describe("enlaces de captación", () => {
  it("dirige las acciones comerciales al canal de WhatsApp de Naty", () => {
    expect(WHATSAPP_URL).toMatch(/^https:\/\/wa\.me\/message\//);
    expect(whatsappWithMessage("Quiero agendar")).toContain("Quiero%20agendar");
  });

  it("mantiene el enlace de Instagram en el perfil de la marca", () => {
    expect(INSTAGRAM_URL).toBe("https://www.instagram.com/naty.studiovalparaiso/");
  });
});

