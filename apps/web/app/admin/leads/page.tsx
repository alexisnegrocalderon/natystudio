"use client";

import { CheckCircle2, Loader2, UserPlus, X } from "lucide-react";
import { toast } from "sonner";
import { formatBusinessDate } from "@naty/shared";
import { ContactActions } from "@/components/admin/ContactActions";
import { trpc } from "@/lib/trpc";

export default function AdminLeadsPage() {
  const { data: leads, isLoading } = trpc.admin.leads.list.useQuery();
  const utils = trpc.useUtils();

  const refresh = () => {
    void utils.admin.leads.list.invalidate();
    void utils.admin.dashboard.invalidate();
  };

  const markConverted = trpc.admin.leads.markConverted.useMutation({
    onSuccess: () => {
      toast.success("Marcado como reservado.");
      refresh();
    },
    onError: error => toast.error(error.message),
  });

  const dismiss = trpc.admin.leads.dismiss.useMutation({
    onSuccess: () => {
      toast.success("Descartado.");
      refresh();
    },
    onError: error => toast.error(error.message),
  });

  const sendEmail = trpc.admin.leads.sendEmail.useMutation({
    onSuccess: () => toast.success("Correo encolado."),
    onError: error => toast.error(error.message),
  });

  return (
    <>
      <div className="admin-header">
        <div>
          <h1>Interesadas</h1>
          <p>Personas que dejaron sus datos pero todavía no reservaron.</p>
        </div>
      </div>

      {isLoading ? (
        <p style={{ color: "var(--muted)", display: "flex", gap: ".6rem", alignItems: "center" }}>
          <Loader2 size={17} className="animate-spin" /> Cargando…
        </p>
      ) : !leads || leads.length === 0 ? (
        <div className="empty-slots">
          <UserPlus size={18} style={{ marginBottom: ".4rem" }} />
          <br />
          No hay contactos pendientes de seguimiento.
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: "1.2rem" }}>
          {leads.map(lead => {
            const busy =
              (markConverted.isPending && markConverted.variables?.id === lead.id) ||
              (dismiss.isPending && dismiss.variables?.id === lead.id);

            return (
              <section key={lead.id} className="admin-card">
                <div style={{ display: "flex", justifyContent: "space-between", flexWrap: "wrap", gap: ".6rem" }}>
                  <div>
                    <h2 style={{ marginBottom: ".2rem" }}>{lead.name || lead.email}</h2>
                    <p style={{ color: "var(--muted)", margin: 0, fontSize: ".85rem" }}>
                      {lead.email}
                      {lead.phone ? ` · ${lead.phone}` : ""}
                      {lead.serviceName ? ` · interesada en ${lead.serviceName}` : ""}
                    </p>
                    <p style={{ color: "var(--muted)", margin: ".2rem 0 0", fontSize: ".78rem" }}>
                      Llegó hasta &ldquo;{lead.step}&rdquo; el {formatBusinessDate(new Date(lead.createdAt))}
                    </p>
                  </div>

                  <div style={{ display: "flex", gap: ".5rem", alignItems: "flex-start" }}>
                    <button
                      type="button"
                      className="mini-button"
                      data-variant="primary"
                      disabled={busy}
                      onClick={() => markConverted.mutate({ id: lead.id })}
                    >
                      <CheckCircle2 size={13} /> Ya reservó
                    </button>
                    <button
                      type="button"
                      className="mini-button"
                      disabled={busy}
                      onClick={() => dismiss.mutate({ id: lead.id })}
                    >
                      <X size={13} /> Descartar
                    </button>
                  </div>
                </div>

                <div style={{ marginTop: "1rem" }}>
                  <ContactActions
                    name={lead.name || lead.email}
                    phone={lead.phone}
                    audience="interesada"
                    sending={sendEmail.isPending}
                    onSendEmail={(subject, body) => sendEmail.mutate({ id: lead.id, subject, body })}
                  />
                </div>
              </section>
            );
          })}
        </div>
      )}
    </>
  );
}
