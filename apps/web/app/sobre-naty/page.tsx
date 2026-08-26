import { Check, GraduationCap, ShieldCheck, Stethoscope } from "lucide-react";
import { ClosingCta } from "@/components/ClosingCta";
import { JsonLd } from "@/components/JsonLd";
import { aboutContent, authorityContent } from "@/content/natyContent";
import { breadcrumbJsonLd, buildMetadata } from "@/lib/seo";

export const metadata = buildMetadata({
  title: "Sobre Naty · Enfermera estética en Valparaíso",
  description:
    "Conoce a Naty, enfermera estética en Valparaíso especializada en retiro de acrocordones: su formación, su enfoque de atención y cómo trabaja cada caso.",
  path: "/sobre-naty",
});

const authorityIcons = [Stethoscope, ShieldCheck, GraduationCap];

export default function AboutPage() {
  return (
    <>
      <JsonLd
        data={breadcrumbJsonLd([
          { name: "Inicio", path: "/" },
          { name: "Sobre Naty", path: "/sobre-naty" },
        ])}
      />

      <section className="section-wrap" style={{ padding: "4rem 0 3rem" }}>
        <p className="eyebrow">
          <span className="eyebrow-dot" />
          {aboutContent.eyebrow}
        </p>
        <h1 className="page-title">
          {aboutContent.title} <em>{aboutContent.accent}</em>
        </h1>
        <p className="lede">{aboutContent.lede}</p>
      </section>

      <section
        className="section-wrap reveal-up"
        style={{
          paddingBottom: "4.5rem",
          display: "grid",
          gridTemplateColumns: "minmax(0, 1.15fr) minmax(0, .85fr)",
          gap: "clamp(2.5rem, 6vw, 5rem)",
          alignItems: "start",
        }}
      >
        <div className="prose-body">
          {aboutContent.paragraphs.map(paragraph => (
            <p key={paragraph}>{paragraph}</p>
          ))}

          <div style={{ display: "grid", gap: ".7rem", marginTop: "2rem" }}>
            {aboutContent.points.map(point => (
              <p
                key={point}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: ".6rem",
                  color: "var(--paper-muted)",
                  fontSize: ".9rem",
                  margin: 0,
                }}
              >
                <Check size={17} aria-hidden="true" style={{ color: "var(--rose)", flex: "0 0 auto" }} />
                {point}
              </p>
            ))}
          </div>
        </div>

        <div className="panel-soft" style={{ minHeight: "320px", display: "grid", alignContent: "end" }}>
          <p
            style={{
              fontFamily: "var(--font-display)",
              fontSize: "clamp(1.9rem, 3.4vw, 2.9rem)",
              lineHeight: 1,
              margin: 0,
            }}
          >
            {aboutContent.graphic}
            <br />
            <em style={{ color: "var(--rose)", fontStyle: "normal" }}>{aboutContent.graphicAccent}</em>
          </p>
        </div>
      </section>

      <section className="authority-band reveal-up" aria-label="Pilares profesionales">
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

      <ClosingCta
        eyebrow="¿Nos conocemos?"
        title="Reserva una"
        accent="evaluación."
        description="Conversamos sobre tu caso y definimos juntas el siguiente paso."
      />
    </>
  );
}
