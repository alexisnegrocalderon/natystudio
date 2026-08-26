/**
 * Configuración única del sitio. Todo lo que el SEO necesita saber sobre el
 * negocio vive aquí para no repetirlo en cada página.
 */

/** URL canónica. Mientras no exista dominio propio apunta al despliegue de Vercel. */
export const SITE_URL = (
  process.env.NEXT_PUBLIC_SITE_URL ??
  (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "http://localhost:3000")
).replace(/\/$/, "");

/**
 * Interruptor de indexación.
 *
 * Se mantiene apagado hasta que el dominio real esté configurado. Si Google
 * llega a indexar el sitio bajo una URL de *.vercel.app, después esas
 * direcciones compiten con el dominio definitivo y sacarlas del índice toma
 * semanas. Encender esto es el último paso del lanzamiento, no el primero.
 */
export const INDEXING_ENABLED = process.env.NEXT_PUBLIC_INDEXING_ENABLED === "true";

export const SITE_NAME = "naty.studio";

export const SITE_DESCRIPTION =
  "Enfermera estética en Valparaíso especializada en retiro de acrocordones. Evaluación personalizada, técnica segura y formación para profesionales.";

export const BUSINESS = {
  name: "naty.studio",
  legalName: "naty.studio",
  description: SITE_DESCRIPTION,
  /** Sin dirección exacta publicada todavía: se completa cuando Naty la confirme. */
  streetAddress: "",
  city: "Valparaíso",
  region: "Región de Valparaíso",
  postalCode: "",
  country: "CL",
  // Coordenadas aproximadas del centro de Valparaíso. Se ajustan cuando haya
  // dirección exacta; no se inventa una precisión que no tenemos.
  latitude: -33.0472,
  longitude: -71.6127,
  whatsapp: "https://wa.me/message/BEZLWH4LIT2PM1",
  instagram: "https://www.instagram.com/naty.studiovalparaiso/",
  priceRange: "$$",
} as const;

export const NAV_LINKS = [
  { href: "/servicios", label: "Servicios" },
  { href: "/sobre-naty", label: "Sobre Naty" },
  { href: "/curso", label: "Curso" },
  { href: "/blog", label: "Guías" },
  { href: "/contacto", label: "Contacto" },
] as const;

export function absoluteUrl(path = "/"): string {
  return `${SITE_URL}${path.startsWith("/") ? path : `/${path}`}`;
}

export function whatsappWithMessage(message: string): string {
  return `${BUSINESS.whatsapp}?text=${encodeURIComponent(message)}`;
}

/**
 * Enlace de WhatsApp hacia el teléfono de una clienta (no el del negocio).
 * `wa.me` sólo acepta dígitos, así que se descarta cualquier `+` o espacio
 * que haya quedado guardado.
 */
export function whatsappTo(phone: string, message: string): string {
  const digits = phone.replace(/\D/g, "");
  return `https://wa.me/${digits}?text=${encodeURIComponent(message)}`;
}
