"use client";

import { Pencil } from "lucide-react";
import { toast } from "sonner";
import { formatBusinessDate, formatBusinessTime, formatDuration } from "@naty/shared";
import type { AppointmentStatus } from "@naty/shared";
import { ContactButtons } from "@/components/admin/ContactButtons";
import type { EditableAppointment } from "@/components/admin/AppointmentEditor";
import { StatusPill } from "@/components/admin/StatusPill";
import { trpc } from "@/lib/trpc";

export type CardAppointment = EditableAppointment & {
  locationName: string;
  durationMin?: number;
};

/**
 * Una cita como tarjeta para el teléfono: hora, clienta, servicio y estado, con los botones para
 * contactarla y para avanzar la cita (confirmar, realizada, no asistió, cancelar, editar).
 */
export function AppointmentCard({
  item,
  showDate = false,
  onEdit,
}: {
  item: CardAppointment;
  showDate?: boolean;
  onEdit: (item: CardAppointment) => void;
}) {
  const utils = trpc.useUtils();
  const done = (message: string) => ({
    onSuccess: () => {
      toast.success(message);
      void utils.admin.invalidate();
    },
    onError: (error: { message: string }) => toast.error(error.message),
  });
  const approve = trpc.admin.appointments.approve.useMutation(done("Cita confirmada. Se le avisó a la clienta."));
  const cancel = trpc.admin.appointments.cancel.useMutation(done("Cita cancelada. Se le avisó a la clienta."));
  const setOutcome = trpc.admin.appointments.setOutcome.useMutation(done("Cita actualizada."));
  const busy = approve.isPending || cancel.isPending || setOutcome.isPending;

  const startsAt = new Date(item.startsAt);
  const status = item.status as AppointmentStatus;
  const firstName = item.customerName.split(" ")[0];

  return (
    <article className="admin-item">
      <div className="admin-item-top">
        <div style={{ minWidth: 0 }}>
          <div className="admin-item-time">{formatBusinessTime(startsAt)} h</div>
          {showDate ? (
            <div className="admin-item-meta" style={{ textTransform: "capitalize" }}>
              {formatBusinessDate(startsAt)}
            </div>
          ) : null}
        </div>
        <StatusPill status={status} />
      </div>

      <div style={{ marginTop: ".6rem" }}>
        <div className="admin-item-title">{item.customerName}</div>
        <div className="admin-item-meta">
          {item.serviceName}
          {item.durationMin ? ` · ${formatDuration(item.durationMin)}` : ""} · {item.locationName}
        </div>
        {item.customerNotes ? <p className="admin-item-note">“{item.customerNotes}”</p> : null}
        {item.adminNotes ? <p className="admin-item-note" style={{ color: "var(--muted)" }}>Nota: {item.adminNotes}</p> : null}
      </div>

      <div className="admin-actions">
        <ContactButtons
          name={item.customerName}
          phone={item.customerPhone}
          message={`Hola ${firstName}, te escribo de Natalia Rodríguez Studio por tu cita del ${formatBusinessDate(startsAt)} a las ${formatBusinessTime(startsAt)} h.`}
        />
        <button type="button" className="admin-action" onClick={() => onEdit(item)} disabled={busy}>
          <Pencil size={15} aria-hidden="true" /> Editar
        </button>
      </div>

      {status === "pending_approval" || status === "confirmed" ? (
        <div className="admin-actions" style={{ marginTop: ".5rem" }}>
          {status === "pending_approval" ? (
            <button type="button" className="admin-action" data-variant="primary" disabled={busy} onClick={() => approve.mutate({ id: item.id })}>
              Confirmar
            </button>
          ) : (
            <>
              <button type="button" className="admin-action" disabled={busy} onClick={() => setOutcome.mutate({ id: item.id, status: "completed" })}>
                Realizada
              </button>
              <button type="button" className="admin-action" disabled={busy} onClick={() => setOutcome.mutate({ id: item.id, status: "no_show" })}>
                No asistió
              </button>
            </>
          )}
          <button
            type="button"
            className="admin-action"
            data-variant="danger"
            disabled={busy}
            onClick={() => {
              if (confirm(`¿Cancelar la cita de ${item.customerName}? Se le avisará por correo.`)) cancel.mutate({ id: item.id });
            }}
          >
            Cancelar
          </button>
        </div>
      ) : null}
    </article>
  );
}
