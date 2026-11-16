"use client";

import { ChevronRight, Loader2, MailWarning } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { formatBusinessDate, formatBusinessTime, formatClp } from "@naty/shared";
import type { AppointmentStatus } from "@naty/shared";
import { AdminSheet } from "@/components/admin/AdminSheet";
import { AppointmentCard, type CardAppointment } from "@/components/admin/AppointmentCard";
import { AppointmentEditor } from "@/components/admin/AppointmentEditor";
import { ContactButtons } from "@/components/admin/ContactButtons";
import { StatusPill } from "@/components/admin/StatusPill";
import { trpc } from "@/lib/trpc";

const purchasesLabel = (count: number) => (count === 1 ? "1 compra" : `${count} compras`);

export default function AdminDashboardPage() {
  const { data, isLoading } = trpc.admin.dashboard.useQuery();
  const [editing, setEditing] = useState<CardAppointment | null>(null);

  if (isLoading || !data) {
    return (
      <p style={{ color: "var(--muted)", display: "flex", gap: ".6rem", alignItems: "center" }}>
        <Loader2 size={17} className="animate-spin" /> Cargando el panel…
      </p>
    );
  }

  const { sales } = data;
  const todayIds = new Set(data.today.map(item => item.id));
  const pendingLater = data.pendingApproval.filter(item => !todayIds.has(item.id));

  return (
    <>
      <div className="admin-header" style={{ marginBottom: "1rem" }}>
        <div>
          <h1>Hola, Naty</h1>
          <p style={{ textTransform: "capitalize" }}>{formatBusinessDate(new Date())}</p>
        </div>
      </div>

      <Link href="/admin/ventas" className="sales-hero">
        <div className="sales-hero-label">Vendido hoy</div>
        <div className="sales-hero-today">{formatClp(sales.todayClp)}</div>
        <div className="sales-hero-sub">
          {sales.todayCount > 0 ? purchasesLabel(sales.todayCount) : "Todavía no hay compras hoy"} · ver Ventas
        </div>
        <div className="sales-hero-split">
          <div>
            <span>Esta semana</span>
            <strong>{formatClp(sales.weekClp)}</strong>
            <span>{purchasesLabel(sales.weekCount)}</span>
          </div>
          <div>
            <span>Este mes</span>
            <strong>{formatClp(sales.monthClp)}</strong>
            <span>{purchasesLabel(sales.monthCount)}</span>
          </div>
        </div>
      </Link>

      <div className="admin-pills">
        <Link href="/admin/agenda" className="admin-pill">
          Por confirmar <strong>{data.pendingApprovalCount}</strong>
        </Link>
        <Link href="/admin/leads" className="admin-pill">
          Interesadas <strong>{data.openLeadsCount}</strong>
        </Link>
        {data.failedEmailCount > 0 ? (
          <Link href="/admin/ajustes" className="admin-pill" data-tone="alert">
            <span style={{ display: "inline-flex", gap: ".35rem", alignItems: "center" }}>
              <MailWarning size={15} aria-hidden="true" /> Correos fallidos
            </span>
            <strong>{data.failedEmailCount}</strong>
          </Link>
        ) : null}
      </div>

      <div className="admin-section-title">
        <h2>Hoy</h2>
        <Link href="/admin/agenda">Agenda</Link>
      </div>
      {data.today.length > 0 ? (
        <div className="admin-list">
          {data.today.map(item => (
            <AppointmentCard key={item.id} item={item} onEdit={setEditing} />
          ))}
        </div>
      ) : (
        <div className="empty-slots">No tienes citas hoy.</div>
      )}

      {pendingLater.length > 0 ? (
        <>
          <div className="admin-section-title">
            <h2>Por confirmar</h2>
          </div>
          <div className="admin-list">
            {pendingLater.map(item => (
              <AppointmentCard key={item.id} item={item} showDate onEdit={setEditing} />
            ))}
          </div>
        </>
      ) : null}

      <div className="admin-section-title">
        <h2>Últimas compras</h2>
        <Link href="/admin/ventas">Ver todas</Link>
      </div>
      {data.recentPurchases.length > 0 ? (
        <div className="admin-list">
          {data.recentPurchases.map(purchase => (
            <article key={purchase.id} className="admin-item">
              <div className="admin-item-top">
                <div style={{ minWidth: 0 }}>
                  <div className="admin-item-title">{purchase.customerName}</div>
                  <div className="admin-item-meta">
                    {purchase.serviceName} · {formatBusinessDate(new Date(purchase.paidAt))}
                  </div>
                </div>
                <div className="admin-item-amount">{formatClp(purchase.netClp)}</div>
              </div>
              <div className="admin-actions">
                <ContactButtons
                  name={purchase.customerName}
                  phone={purchase.customerPhone}
                  email={purchase.customerEmail}
                  withEmail
                  message={`Hola ${purchase.customerName.split(" ")[0]}, te escribo de Natalia Rodríguez Studio por tu reserva de ${purchase.serviceName}.`}
                />
              </div>
            </article>
          ))}
        </div>
      ) : (
        <div className="empty-slots">Aún no hay compras en línea.</div>
      )}

      <div className="admin-section-title">
        <h2>Próximos 7 días</h2>
        <Link href="/admin/agenda">Agenda</Link>
      </div>
      {data.upcoming.length > 0 ? (
        <div className="admin-list" style={{ gap: ".5rem" }}>
          {data.upcoming.map(item => (
            <button
              key={item.id}
              type="button"
              className="admin-item"
              onClick={() => setEditing(item)}
              style={{ display: "flex", alignItems: "center", gap: ".8rem", textAlign: "left", cursor: "pointer", width: "100%" }}
            >
              <div style={{ minWidth: "4.6rem" }}>
                <div className="admin-item-meta" style={{ marginTop: 0, textTransform: "capitalize" }}>
                  {formatBusinessDate(new Date(item.startsAt)).split(",")[0]}
                </div>
                <div className="admin-item-title">{formatBusinessTime(new Date(item.startsAt))} h</div>
              </div>
              <div style={{ minWidth: 0, flex: 1 }}>
                <div className="admin-item-title">{item.customerName}</div>
                <div className="admin-item-meta">{item.serviceName}</div>
              </div>
              <StatusPill status={item.status as AppointmentStatus} />
              <ChevronRight size={17} aria-hidden="true" style={{ color: "var(--muted)", flex: "0 0 auto" }} />
            </button>
          ))}
        </div>
      ) : (
        <div className="empty-slots">No tienes citas agendadas para los próximos siete días.</div>
      )}

      <AdminSheet open={Boolean(editing)} title={editing ? `Cita de ${editing.customerName}` : "Cita"} onClose={() => setEditing(null)}>
        {editing ? <AppointmentEditor item={editing} onClose={() => setEditing(null)} /> : null}
      </AdminSheet>
    </>
  );
}
