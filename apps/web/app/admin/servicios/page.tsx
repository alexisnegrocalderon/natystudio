"use client";

import { Loader2, Plus, X } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { formatClp, formatDuration, serviceInputSchema, type ServiceInput } from "@naty/shared";
import { trpc } from "@/lib/trpc";

const EMPTY: ServiceInput = {
  slug: "",
  name: "",
  shortDescription: "",
  longDescription: "",
  kind: "service",
  durationMin: 45,
  bufferMin: 15,
  priceClp: 0,
  depositPercent: 60,
  active: true,
  sortOrder: 0,
  metaTitle: "",
  metaDescription: "",
};

/** Convierte un nombre en un slug utilizable en la URL. */
function slugify(value: string): string {
  return value
    .toLowerCase()
    .normalize("NFD")
    // Quita los acentos que NFD dejó como caracteres combinantes aparte.
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export default function AdminServicesPage() {
  const utils = trpc.useUtils();
  const { data: services, isLoading } = trpc.admin.services.list.useQuery();

  const [editingId, setEditingId] = useState<number | null>(null);
  const [form, setForm] = useState<ServiceInput>(EMPTY);
  const [open, setOpen] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const refresh = () => utils.admin.services.list.invalidate();

  const create = trpc.admin.services.create.useMutation({
    onSuccess: () => {
      toast.success("Servicio creado y publicado en el sitio.");
      close();
      void refresh();
    },
    onError: error => toast.error(error.message),
  });

  const update = trpc.admin.services.update.useMutation({
    onSuccess: () => {
      toast.success("Servicio actualizado.");
      close();
      void refresh();
    },
    onError: error => toast.error(error.message),
  });

  const archive = trpc.admin.services.archive.useMutation({
    onSuccess: () => {
      toast.success("Servicio archivado. Ya no aparece en el sitio.");
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

  function startEdit(service: NonNullable<typeof services>[number]) {
    setEditingId(service.id);
    setForm({
      slug: service.slug,
      name: service.name,
      shortDescription: service.shortDescription,
      longDescription: service.longDescription ?? "",
      kind: service.kind,
      durationMin: service.durationMin,
      bufferMin: service.bufferMin,
      priceClp: service.priceClp,
      depositPercent: service.depositPercent,
      active: service.active,
      sortOrder: service.sortOrder,
      metaTitle: service.metaTitle ?? "",
      metaDescription: service.metaDescription ?? "",
    });
    setErrors({});
    setOpen(true);
  }

  function submit() {
    const result = serviceInputSchema.safeParse(form);
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
          <h1>Servicios</h1>
          <p>Lo que edites aquí se publica en el sitio automáticamente.</p>
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
          <Plus size={16} /> Nuevo servicio
        </button>
      </div>

      {open ? (
        <section className="admin-card">
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <h2>{editingId ? "Editar servicio" : "Nuevo servicio"}</h2>
            <button type="button" className="mini-button" onClick={close}>
              <X size={13} />
            </button>
          </div>

          <div className="field">
            <label htmlFor="nombre">Nombre</label>
            <input
              id="nombre"
              value={form.name}
              onChange={event => {
                const name = event.target.value;
                // El slug se propone desde el nombre sólo al crear: cambiarlo en
                // un servicio publicado rompería su URL y el posicionamiento.
                setForm(current => ({
                  ...current,
                  name,
                  slug: editingId ? current.slug : slugify(name),
                }));
              }}
            />
            {errors.name ? <p className="field-error">{errors.name}</p> : null}
          </div>

          <div className="field">
            <label htmlFor="slug">Dirección en el sitio</label>
            <input
              id="slug"
              value={form.slug}
              onChange={event => setForm({ ...form, slug: event.target.value })}
            />
            <p style={{ fontSize: ".74rem", color: "var(--muted)", margin: 0 }}>
              /servicios/{form.slug || "…"}
              {editingId ? " · cambiarlo rompe los enlaces existentes y el posicionamiento." : ""}
            </p>
            {errors.slug ? <p className="field-error">{errors.slug}</p> : null}
          </div>

          <div className="field">
            <label htmlFor="corta">Descripción corta</label>
            <textarea
              id="corta"
              style={{ minHeight: "80px" }}
              value={form.shortDescription}
              onChange={event => setForm({ ...form, shortDescription: event.target.value })}
            />
            {errors.shortDescription ? <p className="field-error">{errors.shortDescription}</p> : null}
          </div>

          <div className="field">
            <label htmlFor="larga">Descripción completa</label>
            <textarea
              id="larga"
              value={form.longDescription ?? ""}
              onChange={event => setForm({ ...form, longDescription: event.target.value })}
              placeholder="Separa los párrafos con una línea en blanco."
            />
          </div>

          <div className="field-row">
            <div className="field">
              <label htmlFor="duracion">Duración (minutos)</label>
              <input
                id="duracion"
                type="number"
                min={5}
                value={form.durationMin}
                onChange={event => setForm({ ...form, durationMin: Number(event.target.value) })}
              />
              {errors.durationMin ? <p className="field-error">{errors.durationMin}</p> : null}
            </div>
            <div className="field">
              <label htmlFor="buffer">Limpieza posterior (minutos)</label>
              <input
                id="buffer"
                type="number"
                min={0}
                value={form.bufferMin}
                onChange={event => setForm({ ...form, bufferMin: Number(event.target.value) })}
              />
              <p style={{ fontSize: ".74rem", color: "var(--muted)", margin: 0 }}>
                Tiempo que queda bloqueado después de la cita.
              </p>
            </div>
          </div>

          <div className="field-row">
            <div className="field">
              <label htmlFor="precio">Valor (CLP)</label>
              <input
                id="precio"
                type="number"
                min={0}
                value={form.priceClp}
                onChange={event => setForm({ ...form, priceClp: Number(event.target.value) })}
              />
              <p style={{ fontSize: ".74rem", color: "var(--muted)", margin: 0 }}>
                En 0 el sitio muestra “Consulta el valor”.
              </p>
            </div>
            <div className="field">
              <label htmlFor="abono">Abono mínimo para reservar (%)</label>
              <input
                id="abono"
                type="number"
                min={1}
                max={100}
                value={form.depositPercent}
                onChange={event => setForm({ ...form, depositPercent: Number(event.target.value) })}
              />
              <p style={{ fontSize: ".74rem", color: "var(--muted)", margin: 0 }}>
                {form.priceClp > 0
                  ? `≈ ${formatClp(Math.round((form.priceClp * form.depositPercent) / 100))} sobre el valor actual`
                  : "Se calcula sobre el valor del servicio al reservar."}
              </p>
            </div>
          </div>

          <div className="field-row">
            <div className="field">
              <label htmlFor="tipo">Tipo</label>
              <select
                id="tipo"
                value={form.kind}
                onChange={event => setForm({ ...form, kind: event.target.value as ServiceInput["kind"] })}
              >
                <option value="service">Servicio (aparece en Servicios)</option>
                <option value="course">Curso (aparece en Curso)</option>
              </select>
            </div>
            <div className="field">
              <label htmlFor="orden">Orden</label>
              <input
                id="orden"
                type="number"
                min={0}
                value={form.sortOrder}
                onChange={event => setForm({ ...form, sortOrder: Number(event.target.value) })}
              />
            </div>
          </div>

          <div className="field">
            <label htmlFor="metatitulo">Título para buscadores</label>
            <input
              id="metatitulo"
              maxLength={70}
              value={form.metaTitle ?? ""}
              onChange={event => setForm({ ...form, metaTitle: event.target.value })}
              placeholder="Máximo 70 caracteres"
            />
          </div>

          <div className="field">
            <label htmlFor="metadesc">Descripción para buscadores</label>
            <textarea
              id="metadesc"
              maxLength={160}
              style={{ minHeight: "70px" }}
              value={form.metaDescription ?? ""}
              onChange={event => setForm({ ...form, metaDescription: event.target.value })}
              placeholder="Máximo 160 caracteres. Es el texto que aparece bajo el título en Google."
            />
          </div>

          <label style={{ display: "flex", gap: ".6rem", alignItems: "center", fontSize: ".88rem" }}>
            <input
              type="checkbox"
              checked={form.active}
              onChange={event => setForm({ ...form, active: event.target.checked })}
            />
            Visible en el sitio
          </label>

          <div className="form-actions">
            <button type="button" className="primary-link" onClick={submit} disabled={saving}>
              {saving ? <Loader2 size={16} className="animate-spin" /> : null}
              {editingId ? "Guardar cambios" : "Crear servicio"}
            </button>
            <button type="button" className="ghost-link" onClick={close}>
              Cancelar
            </button>
          </div>
        </section>
      ) : null}

      {isLoading ? (
        <p style={{ color: "var(--muted)", display: "flex", gap: ".6rem", alignItems: "center" }}>
          <Loader2 size={17} className="animate-spin" /> Cargando servicios…
        </p>
      ) : services && services.length > 0 ? (
        <div className="table-scroll">
          <table className="data-table">
            <thead>
              <tr>
                <th>Servicio</th>
                <th>Duración</th>
                <th>Valor</th>
                <th>Estado</th>
                <th>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {services.map(service => (
                <tr key={service.id}>
                  <td>
                    <strong style={{ color: "var(--paper)" }}>{service.name}</strong>
                    <br />
                    <small style={{ color: "var(--muted)" }}>/servicios/{service.slug}</small>
                  </td>
                  <td style={{ whiteSpace: "nowrap" }}>
                    {formatDuration(service.durationMin)}
                    {service.bufferMin > 0 ? (
                      <>
                        <br />
                        <small style={{ color: "var(--muted)" }}>+{service.bufferMin} min limpieza</small>
                      </>
                    ) : null}
                  </td>
                  <td>{service.priceClp > 0 ? formatClp(service.priceClp) : "Sin definir"}</td>
                  <td>
                    <span className="status-pill" data-status={service.active ? "confirmed" : "cancelled"}>
                      {service.active ? "Visible" : "Archivado"}
                    </span>
                  </td>
                  <td>
                    <div className="row-actions">
                      <button type="button" className="mini-button" onClick={() => startEdit(service)}>
                        Editar
                      </button>
                      {service.active ? (
                        <button
                          type="button"
                          className="mini-button"
                          data-variant="danger"
                          onClick={() => {
                            if (confirm(`¿Archivar “${service.name}”? Dejará de aparecer en el sitio.`)) {
                              archive.mutate({ id: service.id });
                            }
                          }}
                        >
                          Archivar
                        </button>
                      ) : null}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="empty-slots">
          Todavía no hay servicios. Crea el primero para que aparezca en el sitio y se pueda reservar.
        </div>
      )}
    </>
  );
}
