import { ClosingCta } from "@/components/ClosingCta";
import { JsonLd } from "@/components/JsonLd";
import { ServiceCard } from "@/components/ServiceCard";
import { servicesPageContent } from "@/content/natyContent";
import { api, safeQuery } from "@/lib/api-server";
import { breadcrumbJsonLd, buildMetadata } from "@/lib/seo";

// Next.js lee este valor estáticamente, así que debe ser un literal.
export const revalidate = 300;

export const metadata = buildMetadata({
  title: "Servicios de enfermería estética en Valparaíso y Providencia",
  description:
    "Conoce los servicios de naty.studio en Valparaíso y Providencia: evaluación, retiro de acrocordones e indicaciones de cuidado posterior. Reserva tu hora en línea.",
  path: "/servicios",
});

export default async function ServicesPage() {
  const services = await safeQuery(
    () => api.catalog.listServices({ kind: "service" }),
    [],
    "catalog.listServices",
  );

  return (
    <>
      <JsonLd
        data={breadcrumbJsonLd([
          { name: "Inicio", path: "/" },
          { name: "Servicios", path: "/servicios" },
        ])}
      />

      <section className="section-wrap reveal-up" style={{ padding: "4rem 0 3rem" }}>
        <p className="eyebrow">
          <span className="eyebrow-dot" />
          {servicesPageContent.eyebrow}
        </p>
        <h1 className="page-title">
          {servicesPageContent.title} <em>{servicesPageContent.accent}</em>
        </h1>
        <p className="lede">{servicesPageContent.description}</p>
      </section>

      <section className="section-wrap" style={{ paddingBottom: "5rem" }}>
        {services.length > 0 ? (
          <div className="card-grid reveal-up">
            {services.map((service, index) => (
              <ServiceCard key={service.slug} service={service} index={index} />
            ))}
          </div>
        ) : (
          <div className="panel reveal-up">
            <p style={{ margin: 0, color: "var(--muted)", lineHeight: 1.7 }}>
              {servicesPageContent.emptyState}
            </p>
          </div>
        )}
      </section>

      <ClosingCta />
    </>
  );
}
