"use client";

import { Download, Loader2, Mail, Printer, Search, Send, Users, X } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { formatBusinessDate, formatClp } from "@naty/shared";
import { trpc } from "@/lib/trpc";

export default function AdminCustomersPage() {
  const [search, setSearch] = useState("");
  const [debounced, setDebounced] = useState("");
  const [broadcasting, setBroadcasting] = useState(false);
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");

  useEffect(() => {
    const timer = setTimeout(() => setDebounced(search.trim()), 300);
    return () => clearTimeout(timer);
  }, [search]);

  const { data, isLoading, isFetching } = trpc.admin.customers.list.useQuery({
    search: debounced || undefined,
    limit: 50,
  });

  const broadcast = trpc.admin.customers.broadcast.useMutation({
    onSuccess: result => {
      toast.success(`Encolado para ${result.recipientCount} ${result.recipientCount === 1 ? "clienta" : "clientas"}.`);
      setBroadcasting(false);
      setSubject("");
      setBody("");
    },
    onError: error => toast.error(error.message),
  });

  const exportParams = debounced ? `?search=${encodeURIComponent(debounced)}` : "";

  return (
    <>
      <div className="admin-header">
        <div>
          <h1>Clientas</h1>
          <p>Todas las personas que reservaron o dejaron sus datos.</p>
        </div>
        <div style={{ display: "flex", gap: ".5rem", flexWrap: "wrap" }}>
          <a className="mini-button" href={`/api/admin/export${exportParams}`}>
            <Download size={13} /> Exportar CSV
          </a>
          <Link className="mini-button" href={`/admin/clientas/imprimir${exportParams}`}>
            <Printer size={13} /> Vista para PDF
          </Link>
          {!broadcasting ? (
            <button type="button" className="mini-button" onClick={() => setBroadcasting(true)}>
              <Mail size={13} /> Envío masivo
            </button>
          ) : null}
        </div>
      </div>

      {broadcasting ? (
        <section className="admin-card">
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <h2>Correo a {debounced ? "las clientas de la búsqueda" : "todas las clientas"}</h2>
            <button type="button" className="mini-button" onClick={() => setBroadcasting(false)}>
              <X size={13} />
            </button>
          </div>
          <p style={{ color: "var(--muted)", fontSize: ".82rem" }}>
            Requiere el dominio de correo verificado en Resend, o sólo llegará a tu propia casilla.
          </p>

          <div className="field">
            <label htmlFor="asunto-masivo">Asunto</label>
            <input id="asunto-masivo" value={subject} onChange={event => setSubject(event.target.value)} />
          </div>

          <div className="field">
            <label htmlFor="cuerpo-masivo">Mensaje</label>
            <textarea id="cuerpo-masivo" value={body} onChange={event => setBody(event.target.value)} />
          </div>

          <button
            type="button"
            className="primary-link"
            disabled={broadcast.isPending || !subject.trim() || !body.trim()}
            onClick={() => broadcast.mutate({ subject: subject.trim(), body: body.trim(), filter: debounced || undefined })}
          >
            {broadcast.isPending ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
            Enviar
          </button>
        </section>
      ) : null}

      <div className="field" style={{ maxWidth: "360px", marginBottom: "1.5rem" }}>
        <label htmlFor="buscar">
          <Search size={13} style={{ display: "inline", marginRight: ".3rem" }} />
          Buscar por nombre, correo o teléfono
        </label>
        <input
          id="buscar"
          value={search}
          onChange={event => setSearch(event.target.value)}
          placeholder="Ej: María, maria@mail.com, +56 9…"
        />
      </div>

      {isLoading ? (
        <p style={{ color: "var(--muted)", display: "flex", gap: ".6rem", alignItems: "center" }}>
          <Loader2 size={17} className="animate-spin" /> Cargando clientas…
        </p>
      ) : !data || data.items.length === 0 ? (
        <div className="empty-slots">
          <Users size={18} style={{ marginBottom: ".4rem" }} />
          <br />
          {debounced ? "No hay clientas que coincidan con la búsqueda." : "Todavía no hay clientas registradas."}
        </div>
      ) : (
        <div className="table-scroll" style={{ opacity: isFetching ? 0.6 : 1 }}>
          <table className="data-table">
            <thead>
              <tr>
                <th>Nombre</th>
                <th>Contacto</th>
                <th>Citas</th>
                <th>Última visita</th>
                <th>Total pagado</th>
              </tr>
            </thead>
            <tbody>
              {data.items.map(customer => (
                <tr key={customer.id}>
                  <td style={{ color: "var(--paper)" }}>
                    <Link href={`/admin/clientas/${customer.id}`}>{customer.name}</Link>
                  </td>
                  <td>
                    {customer.email}
                    <br />
                    <span style={{ color: "var(--muted)" }}>{customer.phone}</span>
                  </td>
                  <td>{customer.appointmentCount}</td>
                  <td>
                    {customer.lastVisit ? formatBusinessDate(new Date(customer.lastVisit)) : "—"}
                  </td>
                  <td>{formatClp(customer.totalPaidClp)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
