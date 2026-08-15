import type { MetadataRoute } from "next";
import { api, safeQuery } from "@/lib/api-server";
import { absoluteUrl } from "@/lib/site";

export const revalidate = 3600;

/**
 * El sitemap se arma con las rutas fijas más los servicios y artículos que
 * devuelve el API, de modo que publicar contenido desde el panel lo incorpora
 * sin tocar el código.
 *
 * Sólo se listan páginas indexables: el embudo de reserva, el detalle de una
 * reserva y el panel quedan fuera a propósito (ver robots.ts).
 */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const now = new Date();

  const staticRoutes: MetadataRoute.Sitemap = [
    { url: absoluteUrl("/"), lastModified: now, changeFrequency: "monthly", priority: 1 },
    { url: absoluteUrl("/servicios"), lastModified: now, changeFrequency: "monthly", priority: 0.9 },
    { url: absoluteUrl("/sobre-naty"), lastModified: now, changeFrequency: "yearly", priority: 0.7 },
    { url: absoluteUrl("/curso"), lastModified: now, changeFrequency: "monthly", priority: 0.7 },
    { url: absoluteUrl("/blog"), lastModified: now, changeFrequency: "weekly", priority: 0.6 },
    { url: absoluteUrl("/contacto"), lastModified: now, changeFrequency: "yearly", priority: 0.6 },
  ];

  const [services, posts] = await Promise.all([
    safeQuery(() => api.catalog.listServices.query(), [], "sitemap: servicios"),
    safeQuery(() => api.content.listPosts.query({ limit: 50 }), [], "sitemap: artículos"),
  ]);

  return [
    ...staticRoutes,
    ...services.map(service => ({
      url: absoluteUrl(`/servicios/${service.slug}`),
      lastModified: service.updatedAt ? new Date(service.updatedAt) : now,
      changeFrequency: "monthly" as const,
      priority: 0.8,
    })),
    ...posts.map(post => ({
      url: absoluteUrl(`/blog/${post.slug}`),
      lastModified: post.publishedAt ? new Date(post.publishedAt) : now,
      changeFrequency: "yearly" as const,
      priority: 0.5,
    })),
  ];
}
