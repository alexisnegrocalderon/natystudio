import type { MetadataRoute } from "next";
import { absoluteUrl, INDEXING_ENABLED } from "@/lib/site";

export default function robots(): MetadataRoute.Robots {
  // Antes del lanzamiento se bloquea el sitio completo. Ver la explicación del
  // interruptor en lib/site.ts: dejar que Google indexe la URL de Vercel crea
  // un problema que después cuesta semanas revertir.
  if (!INDEXING_ENABLED) {
    return { rules: [{ userAgent: "*", disallow: "/" }] };
  }

  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        // Ninguna de estas rutas aporta a la búsqueda: el embudo y el detalle de
        // una reserva son privados, y el panel es de uso interno.
        disallow: ["/admin", "/admin/", "/reservar", "/reserva/", "/api/"],
      },
    ],
    sitemap: absoluteUrl("/sitemap.xml"),
    host: absoluteUrl("/"),
  };
}
