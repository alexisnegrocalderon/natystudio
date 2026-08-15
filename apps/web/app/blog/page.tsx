import { ArrowUpRight } from "lucide-react";
import Link from "next/link";
import { formatBusinessDate } from "@naty/shared";
import { ClosingCta } from "@/components/ClosingCta";
import { JsonLd } from "@/components/JsonLd";
import { api, safeQuery } from "@/lib/api-server";
import { breadcrumbJsonLd, buildMetadata } from "@/lib/seo";

// Next.js lee este valor estáticamente, así que debe ser un literal.
export const revalidate = 300;

export const metadata = buildMetadata({
  title: "Guías de cuidado de la piel · naty.studio",
  description:
    "Artículos y guías sobre acrocordones, cuidado de la piel y qué esperar antes y después de un procedimiento estético, escritos por una enfermera estética.",
  path: "/blog",
});

export default async function BlogIndexPage() {
  const posts = await safeQuery(() => api.content.listPosts(), [], "content.listPosts");

  return (
    <>
      <JsonLd
        data={breadcrumbJsonLd([
          { name: "Inicio", path: "/" },
          { name: "Guías", path: "/blog" },
        ])}
      />

      <section className="section-wrap" style={{ padding: "4rem 0 3rem" }}>
        <p className="eyebrow">
          <span className="eyebrow-dot" />
          Guías de cuidado
        </p>
        <h1 className="page-title">
          Información clara sobre <em>tu piel.</em>
        </h1>
        <p className="lede">
          Artículos escritos desde la consulta: qué son los acrocordones, cómo cuidarse después de un
          procedimiento y qué preguntar antes de decidir.
        </p>
      </section>

      <section className="section-wrap" style={{ paddingBottom: "5rem" }}>
        {posts.length > 0 ? (
          <div className="card-grid">
            {posts.map(post => (
              <article className="service-card" key={post.slug}>
                {post.publishedAt ? (
                  <p className="badge-soft" style={{ marginBottom: "1.2rem" }}>
                    <time dateTime={new Date(post.publishedAt).toISOString()}>
                      {formatBusinessDate(new Date(post.publishedAt))}
                    </time>
                  </p>
                ) : null}

                <h2
                  style={{
                    fontFamily: "var(--font-display)",
                    fontSize: "1.7rem",
                    fontWeight: 500,
                    margin: "0 0 .8rem",
                    lineHeight: 1.1,
                  }}
                >
                  <Link href={`/blog/${post.slug}`}>{post.title}</Link>
                </h2>
                <p style={{ color: "var(--muted)", fontSize: ".9rem", lineHeight: 1.7, flex: 1 }}>
                  {post.excerpt}
                </p>

                <Link className="text-link" href={`/blog/${post.slug}`} style={{ marginTop: "1.4rem" }}>
                  Leer la guía <ArrowUpRight size={16} aria-hidden="true" />
                </Link>
              </article>
            ))}
          </div>
        ) : (
          <div className="panel">
            <p style={{ margin: 0, color: "var(--muted)", lineHeight: 1.75, maxWidth: "540px" }}>
              Estamos preparando las primeras guías. Mientras tanto, puedes escribirnos cualquier duda
              antes de reservar.
            </p>
          </div>
        )}
      </section>

      <ClosingCta
        eyebrow="¿Te quedaste con dudas?"
        title="Conversemos sobre"
        accent="tu caso."
      />
    </>
  );
}
