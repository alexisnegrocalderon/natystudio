import { ImageResponse } from "next/og";

export const alt = "naty.studio · Enfermera estética en Valparaíso y Providencia";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

/**
 * Imagen para compartir en redes, generada en el build. Se dibuja con estilos
 * en línea porque el renderizador de next/og no aplica CSS externo ni Tailwind.
 */
export default function OpengraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          background: "#121014",
          padding: "70px",
          fontFamily: "sans-serif",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "14px" }}>
          <div style={{ width: 14, height: 14, borderRadius: 999, background: "#ea8dac" }} />
          <span style={{ color: "#ffd4e0", fontSize: 24, letterSpacing: 4, textTransform: "uppercase" }}>
            Valparaíso · Providencia
          </span>
        </div>

        <div style={{ display: "flex", flexDirection: "column" }}>
          <span style={{ color: "#f4eeeb", fontSize: 92, lineHeight: 1.02, letterSpacing: -3 }}>
            Cuidado experto,
          </span>
          <span style={{ color: "#ea8dac", fontSize: 92, lineHeight: 1.02, letterSpacing: -3 }}>
            piel en calma.
          </span>
        </div>

        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end" }}>
          <span style={{ color: "#f4eeeb", fontSize: 38, fontWeight: 700, letterSpacing: -1.5 }}>
            naty<span style={{ color: "#ea8dac" }}>.</span>studio
          </span>
          <span style={{ color: "#b8afb4", fontSize: 24 }}>Enfermera estética</span>
        </div>
      </div>
    ),
    size,
  );
}
