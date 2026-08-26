import { marked } from "marked";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { formatBusinessDate } from "@naty/shared";
import { ClosingCta } from "@/components/ClosingCta";
import { JsonLd } from "@/components/JsonLd";
import { api, safeQuery } from "@/lib/api-server";
import { articleJsonLd, breadcrumbJsonLd, buildMetadata } from "@/lib/seo";

// Next.js lee este valor estáticamente, así que debe ser un literal.
export const revalidate = 300;

export async function generateStaticParams() {
  const posts = await safeQuery(
    () => api.content.listPosts({ limit: 50 }),
    [],
    "content.listPosts (generateStaticParams)",
  );
  return posts.map(post => ({ slug: post.slug }));
}

type Props = { params: Promise<{ slug: string }> };

async function loadPost(slug: string) {
  return safeQuery(() => api.content.getPost({ slug }), null, `content.getPost(${slug})`);
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const post = await loadPost(slug);

  if (!post) {
    return buildMetadata({
      title: "Artículo no encontrado",
      description: "El artículo que buscas no está disponible.",
      path: `/blog/${slug}`,
    });
  }

  return buildMetadata({
    title: post.metaTitle || post.title,
    description: post.metaDescription || post.excerpt,
    path: `/blog/${post.slug}`,
    type: "article",
    image: post.coverImageUrl ?? undefined,
    publishedTime: post.publishedAt ? new Date(post.publishedAt).toISOString() : undefined,
  });
}

export default async function BlogPostPage({ params }: Props) {
  const { slug } = await params;
  const post = await loadPost(slug);

  if (!post) notFound();

  /**
   * El markdown lo escribe únicamente Naty desde el panel, detrás del login con
   * segundo factor: la fuente es de confianza. Si en el futuro se admitieran
   * artículos de terceros, habría que sanear el HTML antes de insertarlo.
   */
  const html = await marked.parse(post.body, { async: true });

  return (
    <>
      <JsonLd data={articleJsonLd(post)} />
      <JsonLd
        data={breadcrumbJsonLd([
          { name: "Inicio", path: "/" },
          { name: "Guías", path: "/blog" },
          { name: post.title, path: `/blog/${post.slug}` },
        ])}
      />

      <article className="section-wrap" style={{ padding: "3.5rem 0 4rem", maxWidth: "760px" }}>
        <nav aria-label="Ruta de navegación" style={{ marginBottom: "1.6rem" }}>
          <Link className="text-link" href="/blog">
            ← Todas las guías
          </Link>
        </nav>

        {post.publishedAt ? (
          <p className="eyebrow">
            <span className="eyebrow-dot" />
            <time dateTime={new Date(post.publishedAt).toISOString()}>
              {formatBusinessDate(new Date(post.publishedAt))}
            </time>
          </p>
        ) : null}

        <h1 className="page-title" style={{ fontSize: "clamp(2.3rem, 4.6vw, 3.8rem)" }}>
          {post.title}
        </h1>
        <p className="lede">{post.excerpt}</p>

        <div className="prose-body" dangerouslySetInnerHTML={{ __html: html }} />
      </article>

      <ClosingCta
        eyebrow="¿Necesitas una evaluación?"
        title="Agenda tu hora en"
        accent="Valparaíso o Providencia."
        description="Revisamos tu caso en persona y te orientamos sobre el procedimiento adecuado."
      />
    </>
  );
}
