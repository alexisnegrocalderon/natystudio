import type { Metadata } from "next";
import { absoluteUrl, BUSINESS, INDEXING_ENABLED, LOCATIONS, SITE_NAME, SITE_URL } from "./site";

type PageSeo = {
  title: string;
  description: string;
  /** Ruta relativa, p. ej. "/servicios/retiro-de-acrocordones". */
  path: string;
  image?: string;
  type?: "website" | "article";
  publishedTime?: string;
};

/**
 * Metadatos de una página, con canonical siempre explícito.
 *
 * El canonical evita que la misma página se indexe bajo varias URLs (con y sin
 * barra final, con parámetros de campaña), que es la forma más común de diluir
 * el posicionamiento sin darse cuenta.
 */
export function buildMetadata({
  title,
  description,
  path,
  image,
  type = "website",
  publishedTime,
}: PageSeo): Metadata {
  const url = absoluteUrl(path);
  const ogImage = image ?? absoluteUrl("/opengraph-image");

  return {
    title,
    description,
    alternates: { canonical: url },
    openGraph: {
      type,
      url,
      title,
      description,
      siteName: SITE_NAME,
      locale: "es_CL",
      images: [{ url: ogImage, width: 1200, height: 630, alt: title }],
      ...(publishedTime ? { publishedTime } : {}),
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: [ogImage],
    },
    robots: INDEXING_ENABLED ? undefined : { index: false, follow: false },
  };
}

/** Marca una ruta como privada para los buscadores (panel, embudo, reservas). */
export const noIndexMetadata: Metadata = {
  robots: { index: false, follow: false, nocache: true },
};

/* ────────────────────────────────────────────────────── datos estructurados */

/**
 * Ficha del negocio. Para un servicio local es la señal de mayor impacto:
 * alimenta el panel de conocimiento y los resultados de búsqueda con mapa.
 *
 * Naty atiende en dos sedes, así que se declara un `HealthAndBeautyBusiness`
 * por sede (patrón `@graph` de schema.org) en vez de una sola ficha con una
 * sola dirección.
 */
export function localBusinessJsonLd() {
  return {
    "@context": "https://schema.org",
    "@graph": LOCATIONS.map(location => {
      const address: Record<string, string> = {
        "@type": "PostalAddress",
        addressLocality: location.city,
        addressRegion: location.region,
        addressCountry: BUSINESS.country,
      };
      // Sólo se declara la calle si realmente la tenemos: un dato inventado en
      // los datos estructurados es peor que su ausencia.
      if (location.streetAddress) address.streetAddress = location.streetAddress;
      if (BUSINESS.postalCode) address.postalCode = BUSINESS.postalCode;

      return {
        "@type": "HealthAndBeautyBusiness",
        "@id": `${SITE_URL}#business-${location.slug}`,
        name: `${BUSINESS.name} · ${location.name}`,
        description: BUSINESS.description,
        url: SITE_URL,
        address,
        ...(location.latitude != null && location.longitude != null
          ? {
              geo: {
                "@type": "GeoCoordinates",
                latitude: location.latitude,
                longitude: location.longitude,
              },
            }
          : {}),
        areaServed: { "@type": "City", name: location.city },
        priceRange: BUSINESS.priceRange,
        sameAs: [BUSINESS.instagram],
        image: absoluteUrl("/opengraph-image"),
      };
    }),
  };
}

export function serviceJsonLd(service: {
  name: string;
  description: string;
  slug: string;
  priceClp: number;
}) {
  return {
    "@context": "https://schema.org",
    "@type": "Service",
    name: service.name,
    description: service.description,
    url: absoluteUrl(`/servicios/${service.slug}`),
    provider: LOCATIONS.map(location => ({ "@id": `${SITE_URL}#business-${location.slug}` })),
    areaServed: LOCATIONS.map(location => ({ "@type": "City", name: location.city })),
    // El precio sólo se declara si está definido: publicar 0 le diría a Google
    // que el servicio es gratuito.
    ...(service.priceClp > 0
      ? {
          offers: {
            "@type": "Offer",
            price: service.priceClp,
            priceCurrency: "CLP",
            availability: "https://schema.org/InStock",
            url: absoluteUrl(`/reservar?servicios=${service.slug}`),
          },
        }
      : {}),
  };
}

export function faqJsonLd(items: { question: string; answer: string }[]) {
  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: items.map(item => ({
      "@type": "Question",
      name: item.question,
      acceptedAnswer: { "@type": "Answer", text: item.answer },
    })),
  };
}

export function breadcrumbJsonLd(trail: { name: string; path: string }[]) {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: trail.map((crumb, index) => ({
      "@type": "ListItem",
      position: index + 1,
      name: crumb.name,
      item: absoluteUrl(crumb.path),
    })),
  };
}

export function articleJsonLd(post: {
  title: string;
  excerpt: string;
  slug: string;
  publishedAt: Date | string | null;
  coverImageUrl?: string | null;
}) {
  return {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: post.title,
    description: post.excerpt,
    url: absoluteUrl(`/blog/${post.slug}`),
    datePublished: post.publishedAt
      ? new Date(post.publishedAt).toISOString()
      : undefined,
    author: { "@type": "Person", name: "Naty" },
    publisher: { "@id": `${SITE_URL}#business-${LOCATIONS[0].slug}` },
    ...(post.coverImageUrl ? { image: post.coverImageUrl } : {}),
  };
}
