import { readFileSync } from "node:fs";
import { join } from "node:path";
import { ImageResponse } from "next/og";

export const alt = "Retiro de Acrocordones · Natalia Rodríguez Studio, Valparaíso y Providencia";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

function toDataUri(relativePath: string, mime: string): string {
  const bytes = readFileSync(join(process.cwd(), "public", relativePath));
  return `data:${mime};base64,${bytes.toString("base64")}`;
}

/**
 * Imagen para compartir en redes: misma composición que el hero real (foto
 * de fondo + degradé + logo arriba a la izquierda + título), generada al
 * pedirla — no depende de red (la foto y el logo se leen de /public).
 */
export default function OpengraphImage() {
  const poster = toDataUri("hero/poster.jpg", "image/jpeg");
  const logo = toDataUri("logo-white.png", "image/png");

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          position: "relative",
          fontFamily: "sans-serif",
        }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={poster}
          alt=""
          width={size.width}
          height={size.height}
          style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover" }}
        />

        <div
          style={{
            position: "absolute",
            inset: 0,
            display: "flex",
            background:
              "linear-gradient(180deg, rgba(59,22,38,0.6) 0%, rgba(59,22,38,0.32) 40%, rgba(255,92,137,0.42) 80%, rgba(255,246,248,0.85) 100%)",
          }}
        />

        <div
          style={{
            position: "relative",
            display: "flex",
            flexDirection: "column",
            justifyContent: "space-between",
            width: "100%",
            height: "100%",
            padding: "64px 70px",
          }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={logo} alt="" width={186} height={70} style={{ height: "70px", width: "186px" }} />

          <div style={{ display: "flex", flexDirection: "column" }}>
            <span style={{ color: "#fff6f8", fontSize: 88, fontWeight: 700, lineHeight: 1.02, letterSpacing: -2 }}>
              Retiro de
            </span>
            <span style={{ color: "#ffd4e0", fontSize: 88, fontWeight: 700, lineHeight: 1.02, letterSpacing: -2 }}>
              Acrocordones.
            </span>
          </div>

          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end" }}>
            <span style={{ color: "#3b1626", fontSize: 28, fontWeight: 700, letterSpacing: 1 }}>
              Enfermera estética
            </span>
            <span style={{ color: "#3b1626", fontSize: 24, letterSpacing: 3, textTransform: "uppercase" }}>
              Valparaíso · Providencia
            </span>
          </div>
        </div>
      </div>
    ),
    size,
  );
}
