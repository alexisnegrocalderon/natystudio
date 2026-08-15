import { ArrowUpRight, GraduationCap, ShieldCheck, Stethoscope } from "lucide-react";
import Link from "next/link";
import { ClosingCta } from "@/components/ClosingCta";
import { FaqSection } from "@/components/FaqSection";
import { HeroPortrait } from "@/components/HeroPortrait";
import { JsonLd } from "@/components/JsonLd";
import { ServiceCard } from "@/components/ServiceCard";
import {
  authorityContent,
  coursePageContent,
  faqContent,
  heroContent,
  servicesPageContent,
} from "@/content/natyContent";
import { api, safeQuery } from "@/lib/api-server";
import { buildMetadata, faqJsonLd } from "@/lib/seo";

// Next.js lee este valor estáticamente, así que debe ser un literal.
export const revalidate = 300;

export const metadata = buildMetadata({
  title: "Enfermera estética en Valparaíso · Retiro de acrocordones",
  description:
    "Atención de enfermería estética en Valparaíso especializada en retiro de acrocordones. Evaluación personalizada, técnica segura y reserva de hora en línea.",
  path: "/",
});

const authorityIcons = [Stethoscope, ShieldCheck, GraduationCap];

export default async function HomePage() {
  const services = await safeQuery(
    () => api.catalog.listServices.query({ kind: "service" }),
    [],
    "catalog.listServices",
  );

  return (
    <>
      <JsonLd data={faqJsonLd(faqContent.items)} />

      <section className="hero section-wrap">
        <div className="reveal-up">
          <p className="eyebrow">
            <span className="eyebrow-dot" />
            {heroContent.eyebrow}
          </p>
          <h1>
            {heroContent.title} <em>{heroContent.accent}</em>
          </h1>
          <p className="lede">{heroContent.lede}</p>

          <div className="hero-actions">
            <Link className="primary-link" href="/reservar">
              {heroContent.primaryAction} <ArrowUpRight size={18} aria-hidden="true" />
            </Link>
            <Link className="ghost-link" href="/servicios">
              {heroContent.secondaryAction}
            </Link>
          </div>

          <div className="hero-trust">
            <ShieldCheck size={21} aria-hidden="true" />
            <p>{heroContent.trust}</p>
          </div>
        </div>

        <HeroPortrait />
      </section>

      <section className="authority-band" aria-label="Pilares profesionales">
        {authorityContent.map((item, index) => {
          const Icon = authorityIcons[index] ?? Stethoscope;
          return (
            <div className="authority-item" key={item.title}>
              <Icon size={21} aria-hidden="true" />
              <p>
                <strong>{item.title}</strong>
                <span>{item.description}</span>
              </p>
            </div>
          );
        })}
      </section>

      <section className="section-wrap section-pad">
        <div className="section-heading reveal-up" style={{ marginBottom: "3rem" }}>
          <p className="eyebrow">{servicesPageContent.eyebrow}</p>
          <h2>
            {servicesPageContent.title} <em>{servicesPageContent.accent}</em>
          </h2>
          <p>{servicesPageContent.description}</p>
        </div>

        {services.length > 0 ? (
          <div className="card-grid">
            {services.map((service, index) => (
              <ServiceCard key={service.slug} service={service} index={index} />
            ))}
          </div>
        ) : (
          <div className="panel">
            <p style={{ margin: 0, color: "var(--muted)", lineHeight: 1.7 }}>
              {servicesPageContent.emptyState}
            </p>
          </div>
        )}
      </section>

      <section className="section-wrap">
        <div className="rose-block">
          <p className="eyebrow">
            <GraduationCap size={16} aria-hidden="true" /> {coursePageContent.eyebrow}
          </p>
          <h2>
            {coursePageContent.title} <em>{coursePageContent.accent}</em>
          </h2>
          <p>{coursePageContent.description}</p>
          <Link className="primary-link" href="/curso" style={{ marginTop: "1.6rem" }}>
            Conocer el curso <ArrowUpRight size={18} aria-hidden="true" />
          </Link>
        </div>
      </section>

      <section className="section-wrap section-pad">
        <div className="section-heading" style={{ marginBottom: "2.5rem" }}>
          <p className="eyebrow">{faqContent.eyebrow}</p>
          <h2>
            {faqContent.title} <em>{faqContent.accent}</em>
          </h2>
          <p>{faqContent.description}</p>
        </div>
        <FaqSection items={faqContent.items} />
      </section>

      <ClosingCta />
    </>
  );
}
