"use client";

import { ArrowLeft, Loader2, Pencil, Save, X } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { customerUpdateSchema, formatBusinessDate, formatBusinessTime, formatClp } from "@naty/shared";
import { ContactActions } from "@/components/admin/ContactActions";
import { StatusPill } from "@/components/admin/StatusPill";
import { trpc } from "@/lib/trpc";

export function CustomerDetail({ customerId }: { customerId: number }) {
  const { data, isLoading } = trpc.admin.customers.get.useQuery({ id: customerId });
  const utils = trpc.useUtils();

  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({ name: "", phone: "", notes: "" });
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (data?.customer) {
      setForm({
        name: data.customer.name,
        phone: data.customer.phone,
        notes: data.customer.notes ?? "",
      });
    }
  }, [data?.customer]);

  const update = trpc.admin.customers.update.useMutation({
    onSuccess: () => {
      toast.success("Datos actualizados.");
      setEditing(false);
      void utils.admin.customers.get.invalidate({ id: customerId });
      void utils.admin.customers.list.invalidate();
    },
    onError: error => toast.error(error.message),
  });

  const sendEmail = trpc.admin.customers.sendEmail.useMutation({
    onSuccess: () => toast.success("Correo encolado. Sale en los próximos minutos."),
    onError: error => toast.error(error.message),
  });

  function submit() {
    const result = customerUpdateSchema.safeParse({ id: customerId, ...form });
    if (!result.success) {
      const found: Record<string, string> = {};
      for (const issue of result.error.issues) found[String(issue.path[0])] ??= issue.message;
      setErrors(found);
      return;
    }
    setErrors({});
    update.mutate(result.data);
  }

  if (isLoading || !data) {
    return (
      <p style={{ color: "var(--muted)", display: "flex", gap: ".6rem", alignItems: "center" }}>
        <Loader2 size={17} className="animate-spin" /> Cargando ficha…
      </p>
    );
  }

  const { customer, history } = data;

  return (
    <>
      <div className="admin-header">
        <div>
          <Link href="/admin/clientas" className="mini-button" style={{ marginBottom: "1rem", display: "inline-flex" }}>
            <ArrowLeft size={13} /> Volver a clientas
          </Link>
          <h1>{customer.name}</h1>
          <p>
            Clienta desde {formatBusinessDate(new Date(customer.createdAt))}
          </p>
        </div>
      </div>

      <section className="admin-card">
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <h2>Datos de contacto</h2>
          {!editing ? (
            <button type="button" className="mini-button" onClick={() => setEditing(true)}>
              <Pencil size={13} /> Editar
            </button>
          ) : (
            <button type="button" className="mini-button" onClick={() => setEditing(false)}>
              <X size={13} />
            </button>
          )}
        </div>

        {!editing ? (
          <div className="field-row">
            <div className="field">
              <label>Correo</label>
              <p style={{ margin: 0 }}>{customer.email}</p>
            </div>
            <div className="field">
              <label>Teléfono</label>
              <p style={{ margin: 0 }}>{customer.phone}</p>
            </div>
          </div>
        ) : (
          <>
            <div className="field-row">
              <div className="field">
                <label htmlFor="nombre">Nombre</label>
                <input id="nombre" value={form.name} onChange={event => setForm({ ...form, name: event.target.value })} />
                {errors.name ? <p className="field-error">{errors.name}</p> : null}
              </div>
              <div className="field">
                <label htmlFor="telefono">Teléfono</label>
                <input id="telefono" value={form.phone} onChange={event => setForm({ ...form, phone: event.target.value })} />
                {errors.phone ? <p className="field-error">{errors.phone}</p> : null}
              </div>
            </div>
          </>
        )}

        <div className="field">
          <label htmlFor="notas">Notas privadas (sólo las ve Naty)</label>
          {!editing ? (
            <p style={{ margin: 0, color: customer.notes ? "var(--paper)" : "var(--muted)" }}>
              {customer.notes || "Sin notas."}
            </p>
          ) : (
            <textarea
              id="notas"
              value={form.notes}
              onChange={event => setForm({ ...form, notes: event.target.value })}
              placeholder="Alergias, preferencias, lo que sea útil recordar."
            />
          )}
        </div>

        {editing ? (
          <button type="button" className="primary-link" onClick={submit} disabled={update.isPending}>
            {update.isPending ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
            Guardar
          </button>
        ) : null}
      </section>

      <section className="admin-card">
        <h2>Contactar</h2>
        <ContactActions
          name={customer.name}
          phone={customer.phone}
          sending={sendEmail.isPending}
          onSendEmail={(subject, body) => sendEmail.mutate({ id: customerId, subject, body })}
        />
      </section>

      <h2 style={{ fontSize: "1.3rem", margin: "2rem 0 1rem" }}>Historial de citas</h2>

      {history.length === 0 ? (
        <div className="empty-slots">Todavía no tiene citas registradas.</div>
      ) : (
        <div className="table-scroll">
          <table className="data-table">
            <thead>
              <tr>
                <th>Fecha</th>
                <th>Servicio</th>
                <th>Estado</th>
                <th>Valor</th>
                <th>Pagado</th>
                <th>Saldo</th>
              </tr>
            </thead>
            <tbody>
              {history.map(item => {
                const remaining = item.priceClp - item.amountPaidClp;
                return (
                  <tr key={item.id}>
                    <td style={{ textTransform: "capitalize" }}>
                      {formatBusinessDate(new Date(item.startsAt))}, {formatBusinessTime(new Date(item.startsAt))} h
                    </td>
                    <td>{item.serviceName}</td>
                    <td>
                      <StatusPill status={item.status} />
                    </td>
                    <td>{item.priceClp > 0 ? formatClp(item.priceClp) : "Consulta el valor"}</td>
                    <td>{item.amountPaidClp > 0 ? formatClp(item.amountPaidClp) : "—"}</td>
                    <td>{remaining > 0 ? formatClp(remaining) : "—"}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
