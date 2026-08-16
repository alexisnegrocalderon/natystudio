import { describe, expect, it } from "vitest";
import { COURSE_SECTION_ID, getPilotCatalogSourceLabel, getPilotCatalogState, INSTAGRAM_URL, WHATSAPP_URL, whatsappWithMessage } from "./landing";

describe("enlaces de captación", () => {
  it("dirige las acciones comerciales al canal de WhatsApp de Naty", () => {
    expect(WHATSAPP_URL).toMatch(/^https:\/\/wa\.me\/message\//);
    expect(whatsappWithMessage("Quiero agendar")).toContain("Quiero%20agendar");
  });

  it("mantiene el enlace de Instagram en el perfil de la marca", () => {
    expect(INSTAGRAM_URL).toBe("https://www.instagram.com/naty.studiovalparaiso/");
  });

  it("mantiene un destino interno estable para la sección de formación", () => {
    expect(COURSE_SECTION_ID).toBe("curso");
  });
});

describe("estado del catálogo piloto", () => {
  it("prioriza carga, respaldo y catálogo vacío antes del catálogo listo", () => {
    expect(getPilotCatalogState({ isLoading: true, isError: false, hasService: false })).toBe("loading");
    expect(getPilotCatalogState({ isLoading: false, isError: true, hasService: true })).toBe("fallback");
    expect(getPilotCatalogState({ isLoading: false, isError: false, hasService: false })).toBe("empty");
    expect(getPilotCatalogState({ isLoading: false, isError: false, hasService: true })).toBe("ready");
    expect(getPilotCatalogSourceLabel("ready")).toBe("STAGING");
    expect(getPilotCatalogSourceLabel("fallback")).toBe("PREVIEW");
  });
});
