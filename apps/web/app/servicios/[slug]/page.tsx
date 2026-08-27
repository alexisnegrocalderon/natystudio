import { ArrowUpRight, Clock3, HeartPulse, MapPin, ShieldCheck } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { formatDuration } from "@naty/shared";
import { ClosingCta } from "@/components/ClosingCta";
import { FaqSection } from "@/components/FaqSection";
import { JsonLd } from "@/components/JsonLd";
import { priceLabel } from "@/components/ServiceCard";
import { faqContent } from "@/content/natyContent";
import { api, safeQuery } from "@/lib/api-server";
import { breadcrumbJsonLd, buildMetadata, faqJsonLd, serviceJsonLd } from "@/lib/seo";

// Next.js lee este valor estáticamente, así que debe ser un literal.
export const revalidate = 300;

/**
 * Prerenderiza una página por servicio. `dynamicParams` sigue activo por
 * omisión, así que un servicio creado después del build se genera bajo demanda
 * en la primera visita en lugar de devolver 404.
 */
export async function generateStaticParams() {
  const services = await safeQuery(
    () => api.catalog.listServices(),
    [],
    "catalog.listServices (generateStaticParams)",
  );
  return services.map(service => ({ slug: service.slug }));
}

type Props = { params: Promise<{ slug: string }> };

async function loadService(slug: string) {
  return safeQuery(() => api.catalog.getService({ slug }), null, `catalog.getService(${slug})`);
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const service = await loadService(slug);

  if (!service) {
    return buildMetadata({
      title: "Servicio no encontrado",
      description: "El servicio que buscas no está disponible.",
      path: `/servicios/${slug}`,
    });
  }

  return buildMetadata({
    // Los campos de SEO del panel mandan; si están vacíos se cae al contenido
    // real del servicio en vez de dejar la etiqueta en blanco.
    title: service.metaTitle || `${service.name} en Valparaíso y Providencia`,
    description: service.metaDescription || service.shortDescription,
    path: `/servicios/${service.slug}`,
  });
}

export default async function ServiceDetailPage({ params }: Props) {
  const { slug } = await params;
  const service = await loadService(slug);

  if (!service) notFound();

  const relatedFaq = faqContent.items.slice(0, 4);

  return (
    <>
      <JsonLd
        data={serviceJsonLd({
          name: service.name,
          description: service.shortDescription,
          slug: service.slug,
          priceClp: service.priceClp,
        })}
      />
      <JsonLd
        data={breadcrumbJsonLd([
          { name: "Inicio", path: "/" },
          { name: "Servicios", path: "/servicios" },
          { name: service.name, path: `/servicios/${service.slug}` },
        ])}
      />
      <JsonLd data={faqJsonLd(relatedFaq)} />

      <section className="section-wrap" style={{ padding: "3.5rem 0 3rem" }}>
        <nav aria-label="Ruta de navegación" style={{ marginBottom: "1.6rem" }}>
          <Link className="text-link" href="/servicios">
            ← Todos los servicios
          </Link>
        </nav>

        <p className="eyebrow">
          <span className="eyebrow-dot" />
          Atención presencial en Valparaíso y Providencia
        </p>
        <h1 className="page-title">{service.name}</h1>
        <p className="lede">{service.shortDescription}</p>

        <div className="hero-actions">
          <Link className="primary-link" href={`/reservar?servicios=${service.slug}`}>
            Agendar este servicio <ArrowUpRight size={18} aria-hidden="true" />
          </Link>
          <Link className="ghost-link" href="/contacto">
            Tengo una duda
          </Link>
        </div>
      </section>

      <section className="section-wrap" style={{ paddingBottom: "3.5rem" }}>
        <div className="service-meta" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))" }}>
          <p>
            <span>Valor</span>
            <strong>{priceLabel(service.priceClp)}</strong>
          </p>
          <p>
            <span>Duración</span>
            <strong>{formatDuration(service.durationMin)}</strong>
          </p>
          <p>
            <span>Modalidad</span>
            <strong>Presencial · Valparaíso o Providencia</strong>
          </p>
          {service.priceClp > 0 ? (
            <p>
              <span>Abono mínimo para reservar</span>
              <strong>{priceLabel(Math.round((service.priceClp * service.depositPercent) / 100))}</strong>
            </p>
          ) : null}
        </div>
      </section>

      {service.longDescription ? (
        <section className="section-wrap" style={{ paddingBottom: "4rem" }}>
          <div className="prose-body" style={{ maxWidth: "700px" }}>
            {service.longDescription.split("\n\n").map((paragraph, index) => (
              <p key={index}>{paragraph}</p>
            ))}
          </div>
        </section>
      ) : null}

      <section className="section-wrap" style={{ paddingBottom: "4.5rem" }}>
        <div className="card-grid">
          <div className="panel">
            <ShieldCheck size={22} aria-hidden="true" style={{ color: "var(--rose)" }} />
            <h3 style={{ fontFamily: "var(--font-display)", fontSize: "1.4rem", margin: "1rem 0 .6rem" }}>
              Evaluación primero
            </h3>
            <p style={{ margin: 0, color: "var(--muted)", fontSize: ".9rem", lineHeight: 1.7 }}>
              Cada atención parte por revisar tu caso y confirmar que el procedimiento es adecuado para ti.
            </p>
          </div>
          <div className="panel">
            <Clock3 size={22} aria-hidden="true" style={{ color: "var(--rose)" }} />
            <h3 style={{ fontFamily: "var(--font-display)", fontSize: "1.4rem", margin: "1rem 0 .6rem" }}>
              Tiempo reservado para ti
            </h3>
            <p style={{ margin: 0, color: "var(--muted)", fontSize: ".9rem", lineHeight: 1.7 }}>
              La agenda considera {formatDuration(service.durationMin)} de atención más el tiempo de
              preparación, sin apuros entre una hora y otra.
            </p>
          </div>
          <div className="panel">
            <MapPin size={22} aria-hidden="true" style={{ color: "var(--rose)" }} />
            <h3 style={{ fontFamily: "var(--font-display)", fontSize: "1.4rem", margin: "1rem 0 .6rem" }}>
              En Valparaíso o Providencia
            </h3>
            <p style={{ margin: 0, color: "var(--muted)", fontSize: ".9rem", lineHeight: 1.7 }}>
              Eliges la sede al reservar. La dirección exacta se envía en el correo de confirmación de tu
              cita.
            </p>
          </div>
        </div>
      </section>

      <section className="section-wrap section-pad divider-top">
        <div className="section-heading" style={{ marginBottom: "2.5rem" }}>
          <p className="eyebrow">
            <HeartPulse size={15} aria-hidden="true" /> Antes de reservar
          </p>
          <h2>
            Preguntas <em>frecuentes.</em>
          </h2>
        </div>
        <FaqSection items={relatedFaq} />
      </section>

      <ClosingCta
        title="Reserva tu hora para"
        accent={service.name.toLowerCase()}
        description="Elige el día y la hora que te acomoden. Recibirás la confirmación por correo."
        href={`/reservar?servicios=${service.slug}`}
      />
    </>
  );
}
