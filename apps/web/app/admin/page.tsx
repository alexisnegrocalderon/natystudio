"use client";

import { CalendarClock, Loader2, MailWarning, TrendingUp, UserPlus, Wallet } from "lucide-react";
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
          <div className="stat-card-icon" data-tone="rose">
            <CalendarClock size={17} aria-hidden="true" />
          </div>
          <span>Por confirmar</span>
          <strong>{data.pendingApprovalCount}</strong>
          <small>{data.pendingApprovalCount === 1 ? "reserva esperando" : "reservas esperando"}</small>
        </div>

        <Link href="/admin/ventas" className="stat-card">
          <div className="stat-card-icon" data-tone="bright">
            <TrendingUp size={17} aria-hidden="true" />
          </div>
          <span>Cobrado este mes</span>
          <strong>{formatClp(data.monthRevenueClp)}</strong>
          <small>
            <Wallet size={12} style={{ display: "inline", marginRight: ".25rem" }} />
            citas realizadas · ver Ventas
          </small>
        </Link>

        <div className="stat-card">
          <div className="stat-card-icon" data-tone="lavender">
            <UserPlus size={17} aria-hidden="true" />
          </div>
          <span>Interesadas</span>
          <strong>{data.openLeadsCount}</strong>
          <small>dejaron sus datos sin reservar</small>
        </div>

        {data.failedEmailCount > 0 ? (
          <div className="stat-card" style={{ borderColor: "rgba(225,29,72,.35)" }}>
            <div className="stat-card-icon" data-tone="pale">
              <MailWarning size={17} aria-hidden="true" style={{ color: "#e11d48" }} />
            </div>
            <span style={{ color: "#e11d48" }}>Correos fallidos</span>
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
