import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { PilotServiceCard } from "./PilotServiceCard";

describe("PilotServiceCard", () => {
  it("renders Neon catalogue data and the STAGING label instead of the static fallback when ready", () => {
    const html = renderToStaticMarkup(
      <PilotServiceCard
        state="ready"
        service={{
          name: "Servicio desde Neon",
          description: "Descripción obtenida desde staging.",
          priceNote: "Valor desde Neon",
          durationNote: "Duración desde Neon",
        }}
        fallback={{
          title: "Fallback estático",
          description: "Descripción de respaldo.",
          value: "Valor de respaldo",
          duration: "Duración de respaldo",
        }}
        statusMessage="Información disponible desde el entorno de preview."
      >
        <a href="https://wa.me/message/example">Reservar</a>
      </PilotServiceCard>,
    );

    expect(html).toContain("SERVICIO 01 · STAGING");
    expect(html).toContain("Servicio desde Neon");
    expect(html).toContain("Valor desde Neon");
    expect(html).not.toContain("Fallback estático");
  });
});
