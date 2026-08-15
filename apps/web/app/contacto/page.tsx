import { ArrowUpRight, CalendarCheck, Instagram, MapPin, MessageCircle } from "lucide-react";
import Link from "next/link";
import { FaqSection } from "@/components/FaqSection";
import { JsonLd } from "@/components/JsonLd";
import { contactPageContent, faqContent } from "@/content/natyContent";
import { breadcrumbJsonLd, buildMetadata, faqJsonLd } from "@/lib/seo";
import { BUSINESS, whatsappWithMessage } from "@/lib/site";

export const metadata = buildMetadata({
  title: "Contacto y ubicación · naty.studio Valparaíso",
  description:
    "Contacta a naty.studio en Valparaíso: reserva tu hora en línea, escríbenos por WhatsApp o revisa nuestro Instagram. Atención de enfermería estética con evaluación previa.",
  path: "/contacto",
});

export default function ContactPage() {
  return (
    <>
      <JsonLd
        data={breadcrumbJsonLd([
          { name: "Inicio", path: "/" },
          { name: "Contacto", path: "/contacto" },
        ])}
      />
      <JsonLd data={faqJsonLd(faqContent.items)} />

      <section className="section-wrap" style={{ padding: "4rem 0 3rem" }}>
        <p className="eyebrow">
          <span className="eyebrow-dot" />
          {contactPageContent.eyebrow}
        </p>
        <h1 className="page-title">
          {contactPageContent.title} <em>{contactPageContent.accent}</em>
        </h1>
        <p className="lede">{contactPageContent.description}</p>
      </section>

      <section className="section-wrap" style={{ paddingBottom: "4.5rem" }}>
        <div className="card-grid">
          <article className="panel">
            <CalendarCheck size={24} aria-hidden="true" style={{ color: "var(--rose)" }} />
            <h2 style={{ fontFamily: "var(--font-display)", fontSize: "1.6rem", margin: "1rem 0 .7rem" }}>
              Reserva en línea
            </h2>
            <p style={{ color: "var(--muted)", fontSize: ".9rem", lineHeight: 1.7 }}>
              La forma más rápida: eliges servicio, día y hora, y recibes la confirmación por correo.
            </p>
            <Link className="primary-link" href="/reservar" style={{ marginTop: "1.2rem" }}>
              Agendar hora <ArrowUpRight size={17} aria-hidden="true" />
            </Link>
          </article>

          <article className="panel">
            <MessageCircle size={24} aria-hidden="true" style={{ color: "var(--rose)" }} />
            <h2 style={{ fontFamily: "var(--font-display)", fontSize: "1.6rem", margin: "1rem 0 .7rem" }}>
              WhatsApp
            </h2>
            <p style={{ color: "var(--muted)", fontSize: ".9rem", lineHeight: 1.7 }}>
              Para dudas previas, orientación sobre tu caso o consultas por el curso.
            </p>
            <a
              className="ghost-link"
              href={whatsappWithMessage("Hola, tengo una consulta sobre la atención en naty.studio.")}
              target="_blank"
              rel="noreferrer"
              style={{ marginTop: "1.2rem" }}
            >
              Escribir por WhatsApp <ArrowUpRight size={17} aria-hidden="true" />
            </a>
          </article>

          <article className="panel">
            <MapPin size={24} aria-hidden="true" style={{ color: "var(--rose)" }} />
            <h2 style={{ fontFamily: "var(--font-display)", fontSize: "1.6rem", margin: "1rem 0 .7rem" }}>
              Dónde atendemos
            </h2>
            <p style={{ color: "var(--muted)", fontSize: ".9rem", lineHeight: 1.7 }}>
              Atención presencial en {BUSINESS.city}, {BUSINESS.region}. La dirección exacta se envía en
              el correo de confirmación de tu cita.
            </p>
            <a
              className="ghost-link"
              href={BUSINESS.instagram}
              target="_blank"
              rel="noreferrer"
              style={{ marginTop: "1.2rem" }}
            >
              <Instagram size={17} aria-hidden="true" /> Ver Instagram
            </a>
          </article>
        </div>
      </section>

      <section className="section-wrap section-pad divider-top">
        <div className="section-heading" style={{ marginBottom: "2.5rem" }}>
          <p className="eyebrow">{faqContent.eyebrow}</p>
          <h2>
            {faqContent.title} <em>{faqContent.accent}</em>
          </h2>
          <p>{faqContent.description}</p>
        </div>
        <FaqSection items={faqContent.items} />
      </section>
    </>
  );
}
