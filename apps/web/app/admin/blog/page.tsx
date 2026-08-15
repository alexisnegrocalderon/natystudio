"use client";

import { Loader2, Plus, X } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { formatBusinessDate, postInputSchema } from "@naty/shared";
import { trpc } from "@/lib/trpc";

type PostForm = {
  slug: string;
  title: string;
  excerpt: string;
  body: string;
  metaTitle: string;
  metaDescription: string;
  published: boolean;
};

const EMPTY: PostForm = {
  slug: "",
  title: "",
  excerpt: "",
  body: "",
  metaTitle: "",
  metaDescription: "",
  published: false,
};

function slugify(value: string): string {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export default function AdminBlogPage() {
  const utils = trpc.useUtils();
  const { data: posts, isLoading } = trpc.admin.posts.list.useQuery();

  const [form, setForm] = useState<PostForm>(EMPTY);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [open, setOpen] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const refresh = () => utils.admin.posts.list.invalidate();

  const create = trpc.admin.posts.create.useMutation({
    onSuccess: () => {
      toast.success("Artículo creado.");
      close();
      void refresh();
    },
    onError: error => toast.error(error.message),
  });

  const update = trpc.admin.posts.update.useMutation({
    onSuccess: () => {
      toast.success("Artículo actualizado.");
      close();
      void refresh();
    },
    onError: error => toast.error(error.message),
  });

  const remove = trpc.admin.posts.delete.useMutation({
    onSuccess: () => {
      toast.success("Artículo eliminado.");
      void refresh();
    },
    onError: error => toast.error(error.message),
  });

  function close() {
    setOpen(false);
    setEditingId(null);
    setForm(EMPTY);
    setErrors({});
  }

  function submit() {
    const result = postInputSchema.safeParse(form);
    if (!result.success) {
      const found: Record<string, string> = {};
      for (const issue of result.error.issues) found[String(issue.path[0])] ??= issue.message;
      setErrors(found);
      return;
    }

    if (editingId) update.mutate({ id: editingId, data: result.data });
    else create.mutate(result.data);
  }

  const saving = create.isPending || update.isPending;

  return (
    <>
      <div className="admin-header">
        <div>
          <h1>Blog</h1>
          <p>Las guías atraen visitas desde buscadores y responden dudas antes de reservar.</p>
        </div>
        <button
          type="button"
          className="primary-link"
          onClick={() => {
            setForm(EMPTY);
            setEditingId(null);
            setOpen(true);
          }}
        >
          <Plus size={16} /> Nuevo artículo
        </button>
      </div>

      {open ? (
        <section className="admin-card">
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <h2>{editingId ? "Editar artículo" : "Nuevo artículo"}</h2>
            <button type="button" className="mini-button" onClick={close}>
              <X size={13} />
            </button>
          </div>

          <div className="field">
            <label htmlFor="titulo">Título</label>
            <input
              id="titulo"
              value={form.title}
              onChange={event => {
                const title = event.target.value;
                setForm(current => ({
                  ...current,
                  title,
                  slug: editingId ? current.slug : slugify(title),
                }));
              }}
            />
            {errors.title ? <p className="field-error">{errors.title}</p> : null}
          </div>

          <div className="field">
            <label htmlFor="slug">Dirección</label>
            <input id="slug" value={form.slug} onChange={event => setForm({ ...form, slug: event.target.value })} />
            <p style={{ fontSize: ".74rem", color: "var(--muted)", margin: 0 }}>/blog/{form.slug || "…"}</p>
            {errors.slug ? <p className="field-error">{errors.slug}</p> : null}
          </div>

          <div className="field">
            <label htmlFor="resumen">Resumen</label>
            <textarea
              id="resumen"
              style={{ minHeight: "70px" }}
              value={form.excerpt}
              onChange={event => setForm({ ...form, excerpt: event.target.value })}
              placeholder="Una o dos frases. Aparece en el listado y en los resultados de búsqueda."
            />
          </div>

          <div className="field">
            <label htmlFor="cuerpo">Contenido</label>
            <textarea
              id="cuerpo"
              style={{ minHeight: "320px", fontFamily: "ui-monospace, Menlo, monospace", fontSize: ".85rem" }}
              value={form.body}
              onChange={event => setForm({ ...form, body: event.target.value })}
              placeholder={"Puedes usar formato Markdown:\n\n## Un subtítulo\n\nUn párrafo normal.\n\n- Una lista\n- Otro punto\n\n**Texto destacado**"}
            />
            {errors.body ? <p className="field-error">{errors.body}</p> : null}
          </div>

          <div className="field">
            <label htmlFor="metatitulo">Título para buscadores (opcional)</label>
            <input
              id="metatitulo"
              maxLength={70}
              value={form.metaTitle}
              onChange={event => setForm({ ...form, metaTitle: event.target.value })}
            />
          </div>

          <div className="field">
            <label htmlFor="metadesc">Descripción para buscadores (opcional)</label>
            <textarea
              id="metadesc"
              maxLength={160}
              style={{ minHeight: "70px" }}
              value={form.metaDescription}
              onChange={event => setForm({ ...form, metaDescription: event.target.value })}
            />
          </div>

          <label style={{ display: "flex", gap: ".6rem", alignItems: "center", fontSize: ".88rem" }}>
            <input
              type="checkbox"
              checked={form.published}
              onChange={event => setForm({ ...form, published: event.target.checked })}
            />
            Publicado y visible en el sitio
          </label>

          <div className="form-actions">
            <button type="button" className="primary-link" onClick={submit} disabled={saving}>
              {saving ? <Loader2 size={16} className="animate-spin" /> : null}
              {editingId ? "Guardar cambios" : "Crear artículo"}
            </button>
            <button type="button" className="ghost-link" onClick={close}>
              Cancelar
            </button>
          </div>
        </section>
      ) : null}

      {isLoading ? (
        <p style={{ color: "var(--muted)", display: "flex", gap: ".6rem", alignItems: "center" }}>
          <Loader2 size={17} className="animate-spin" /> Cargando artículos…
        </p>
      ) : posts && posts.length > 0 ? (
        <div className="table-scroll">
          <table className="data-table">
            <thead>
              <tr>
                <th>Artículo</th>
                <th>Estado</th>
                <th>Publicado</th>
                <th>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {posts.map(post => (
                <tr key={post.id}>
                  <td>
                    <strong style={{ color: "var(--paper)" }}>{post.title}</strong>
                    <br />
                    <small style={{ color: "var(--muted)" }}>/blog/{post.slug}</small>
                  </td>
                  <td>
                    <span className="status-pill" data-status={post.publishedAt ? "confirmed" : "pending_approval"}>
                      {post.publishedAt ? "Publicado" : "Borrador"}
                    </span>
                  </td>
                  <td style={{ textTransform: "capitalize" }}>
                    {post.publishedAt ? formatBusinessDate(new Date(post.publishedAt)) : "—"}
                  </td>
                  <td>
                    <div className="row-actions">
                      <button
                        type="button"
                        className="mini-button"
                        onClick={() => {
                          setEditingId(post.id);
                          setForm({
                            slug: post.slug,
                            title: post.title,
                            excerpt: post.excerpt,
                            body: post.body,
                            metaTitle: post.metaTitle ?? "",
                            metaDescription: post.metaDescription ?? "",
                            published: Boolean(post.publishedAt),
                          });
                          setOpen(true);
                        }}
                      >
                        Editar
                      </button>
                      <button
                        type="button"
                        className="mini-button"
                        data-variant="danger"
                        onClick={() => {
                          if (confirm(`¿Eliminar “${post.title}”? No se puede deshacer.`)) {
                            remove.mutate({ id: post.id });
                          }
                        }}
                      >
                        Eliminar
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="empty-slots">
          Aún no hay artículos. Escribir sobre las dudas que más te preguntan es la forma más barata de
          atraer visitas desde Google.
        </div>
      )}
    </>
  );
}
