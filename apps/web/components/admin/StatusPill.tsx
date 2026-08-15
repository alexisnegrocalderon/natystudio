import type { AppointmentStatus } from "@naty/shared";

const LABELS: Record<AppointmentStatus, string> = {
  pending_payment: "Esperando pago",
  pending_approval: "Por confirmar",
  confirmed: "Confirmada",
  cancelled: "Cancelada",
  completed: "Realizada",
  no_show: "No asistió",
};

export function StatusPill({ status }: { status: AppointmentStatus }) {
  return (
    <span className="status-pill" data-status={status}>
      {LABELS[status]}
    </span>
  );
}
