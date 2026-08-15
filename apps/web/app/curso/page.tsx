import { ArrowUpRight, GraduationCap, Users } from "lucide-react";
import { JsonLd } from "@/components/JsonLd";
import { ServiceCard } from "@/components/ServiceCard";
import { coursePageContent } from "@/content/natyContent";
import { api, safeQuery } from "@/lib/api-server";
import { breadcrumbJsonLd, buildMetadata } from "@/lib/seo";
import { whatsappWithMessage } from "@/lib/site";

// Next.js lee este valor estáticamente, así que debe ser un literal.
export const revalidate = 300;

export const metadata = buildMetadata({
  title: "Curso para profesionales · Retiro de acrocordones",
  description:
    "Formación para profesionales de salud y estética sobre el retiro de acrocordones: técnica, criterios de atención y enfoque práctico. Déjanos tu interés.",
  path: "/curso",
});

export default async function CoursePage() {
  // Los cursos se administran como servicios con kind="course", así que cuando
  // Naty publique el programa aparecerá aquí sin tocar el código.
  const courses = await safeQuery(
    () => api.catalog.listServices({ kind: "course" }),
    [],
    "catalog.listServices (curso)",
  );

  return (
    <>
      <JsonLd
        data={breadcrumbJsonLd([
          { name: "Inicio", path: "/" },
          { name: "Curso", path: "/curso" },
        ])}
      />

      <section className="section-wrap" style={{ padding: "4rem 0 3rem" }}>
        <div className="rose-block">
          <p className="eyebrow">
            <GraduationCap size={16} aria-hidden="true" /> {coursePageContent.eyebrow}
          </p>
          <h1 style={{ maxWidth: "700px", fontSize: "clamp(2.6rem, 5vw, 4.8rem)", lineHeight: 0.94, margin: "0 0 1.3rem" }}>
            {coursePageContent.title} <em style={{ color: "#613044", fontStyle: "normal" }}>{coursePageContent.accent}</em>
          </h1>
          <p>{coursePageContent.description}</p>

          <div className="rose-detail-grid">
            <p>
              <span>Dirigido a</span>
              {coursePageContent.audience}
            </p>
            <p>
              <span>Modalidad</span>
              {coursePageContent.modality}
            </p>
          </div>

          <a
            className="primary-link"
            href={whatsappWithMessage(
              "Hola, me interesa recibir información sobre el curso para profesionales.",
            )}
            target="_blank"
            rel="noreferrer"
          >
            {coursePageContent.action} <ArrowUpRight size={18} aria-hidden="true" />
          </a>
        </div>
      </section>

      <section className="section-wrap" style={{ paddingBottom: "5rem" }}>
        {courses.length > 0 ? (
          <>
            <div className="section-heading" style={{ marginBottom: "2.5rem" }}>
              <p className="eyebrow">Programas disponibles</p>
              <h2>
                Formación <em>abierta.</em>
              </h2>
            </div>
            <div className="card-grid">
              {courses.map((course, index) => (
                <ServiceCard key={course.slug} service={course} index={index} />
              ))}
            </div>
          </>
        ) : (
          <div className="panel" style={{ display: "grid", gap: "1rem", justifyItems: "start" }}>
            <span className="badge-soft">
              <Users size={13} aria-hidden="true" /> En preparación
            </span>
            <p style={{ margin: 0, color: "var(--muted)", lineHeight: 1.75, maxWidth: "560px" }}>
              {coursePageContent.note}
            </p>
            <a
              className="text-link"
              href={whatsappWithMessage("Hola, quiero que me avisen cuando abran los cupos del curso.")}
              target="_blank"
              rel="noreferrer"
            >
              Avísenme cuando abran los cupos <ArrowUpRight size={16} aria-hidden="true" />
            </a>
          </div>
        )}
      </section>
    </>
  );
}
