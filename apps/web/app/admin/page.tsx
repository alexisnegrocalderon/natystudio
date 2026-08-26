"use client";

import { CalendarClock, Loader2, MailWarning, TrendingUp, UserPlus } from "lucide-react";
import Link from "next/link";
import { formatBusinessDate, formatBusinessTime, formatClp } from "@naty/shared";
import { StatusPill } from "@/components/admin/StatusPill";
import { trpc } from "@/lib/trpc";

export default function AdminDashboardPage() {
  const { data, isLoading } = trpc.admin.dashboard.useQuery();

  if (isLoading || !data) {
    return (
      <p style={{ color: "var(--muted)", display: "flex", gap: ".6rem", alignItems: "center" }}>
        <Loader2 size={17} className="animate-spin" /> Cargando el panel…
      </p>
    );
  }

  return (
    <>
      <div className="admin-header">
        <div>
          <h1>Hola, Naty</h1>
          <p>Resumen de tu agenda y tu actividad reciente.</p>
        </div>
        <Link className="primary-link" href="/admin/agenda">
          Ver la agenda completa
        </Link>
      </div>

      <div className="stat-grid">
        <div className="stat-card">
          <span>
            <CalendarClock size={12} style={{ display: "inline", marginRight: ".3rem" }} />
            Por confirmar
          </span>
          <strong>{data.pendingApprovalCount}</strong>
          <small>{data.pendingApprovalCount === 1 ? "reserva esperando" : "reservas esperando"}</small>
        </div>

        <div className="stat-card">
          <span>
            <TrendingUp size={12} style={{ display: "inline", marginRight: ".3rem" }} />
            Cobrado este mes
          </span>
          <strong>{formatClp(data.monthRevenueClp)}</strong>
          <small>citas realizadas</small>
        </div>

        <div className="stat-card">
          <span>
            <UserPlus size={12} style={{ display: "inline", marginRight: ".3rem" }} />
            Interesadas
          </span>
          <strong>{data.openLeadsCount}</strong>
          <small>dejaron sus datos sin reservar</small>
        </div>

        {data.failedEmailCount > 0 ? (
          <div className="stat-card" style={{ borderColor: "rgba(255,154,154,.4)" }}>
            <span style={{ color: "#ff9a9a" }}>
              <MailWarning size={12} style={{ display: "inline", marginRight: ".3rem" }} />
              Correos fallidos
            </span>
            <strong>{data.failedEmailCount}</strong>
            <small>revisa la configuración de correo</small>
          </div>
        ) : null}
      </div>

      <h2 style={{ fontSize: "1.3rem", marginBottom: "1rem" }}>Próximos 7 días</h2>

      {data.upcoming.length > 0 ? (
        <div className="table-scroll">
          <table className="data-table">
            <thead>
              <tr>
                <th>Fecha</th>
                <th>Hora</th>
                <th>Clienta</th>
                <th>Servicio</th>
                <th>Sede</th>
                <th>Estado</th>
              </tr>
            </thead>
            <tbody>
              {data.upcoming.map(item => (
                <tr key={item.id}>
                  <td style={{ textTransform: "capitalize" }}>
                    {formatBusinessDate(new Date(item.startsAt))}
                  </td>
                  <td>{formatBusinessTime(new Date(item.startsAt))} h</td>
                  <td style={{ color: "var(--paper)" }}>{item.customerName}</td>
                  <td>{item.serviceName}</td>
                  <td>{item.locationName}</td>
                  <td>
                    <StatusPill status={item.status} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="empty-slots">No tienes citas agendadas para los próximos siete días.</div>
      )}
    </>
  );
}
