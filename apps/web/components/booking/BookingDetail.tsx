"use client";

import {
  AlertCircle,
  ArrowUpRight,
  CalendarPlus,
  CheckCircle2,
  Clock3,
  Loader2,
  XCircle,
} from "lucide-react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useState } from "react";
import {
  formatBusinessDate,
  formatBusinessTime,
  formatClp,
  formatDuration,
  type AppointmentStatus,
} from "@naty/shared";
import { trpc } from "@/lib/trpc";

const STATUS_COPY: Record<AppointmentStatus, { label: string; detail: string; tone: string }> = {
  pending_payment: {
    label: "Esperando el pago",
    detail: "Tu horario está reservado mientras completas el pago.",
    tone: "warn",
  },
  pending_approval: {
    label: "Pendiente de confirmación",
    detail: "Naty está revisando tu solicitud y te confirmará por correo.",
    tone: "warn",
  },
  confirmed: {
    label: "Confirmada",
    detail: "Tu cita está agendada. Te esperamos.",
    tone: "ok",
  },
  cancelled: {
    label: "Cancelada",
    detail: "Esta cita ya no está agendada.",
    tone: "error",
  },
  completed: {
    label: "Realizada",
    detail: "Gracias por tu visita.",
    tone: "ok",
  },
  no_show: {
    label: "No asistida",
    detail: "No registramos tu asistencia a esta cita.",
    tone: "error",
  },
};

export function BookingDetail({ publicId }: { publicId: string }) {
  const params = useSearchParams();
  // El token llega en el enlace del correo. Sin él se puede ver la reserva pero
  // no cancelarla: así conocer el publicId no basta para cancelar la hora ajena.
  const cancelToken = params.get("token");

  const [cancelled, setCancelled] = useState(false);
  const utils = trpc.useUtils();

  const { data: booking, isLoading } = trpc.booking.getByPublicId.useQuery({ publicId });
  const cancelBooking = trpc.booking.cancel.useMutation({
    onSuccess: () => {
      setCancelled(true);
      void utils.booking.getByPublicId.invalidate({ publicId });
    },
  });

  if (isLoading) {
    return (
      <p style={{ color: "var(--muted)", display: "flex", gap: ".6rem", alignItems: "center" }}>
        <Loader2 size={17} className="animate-spin" /> Cargando tu reserva…
      </p>
    );
  }

  if (!booking) {
    return (
      <div className="notice" data-tone="error">
        <AlertCircle size={18} />
        <span>
          No encontramos esta reserva. Revisa el enlace del correo o escríbenos y la buscamos contigo.
        </span>
      </div>
    );
  }

  const status = STATUS_COPY[booking.status];
  const startsAt = new Date(booking.startsAt);
  const isActive = booking.status === "confirmed" || booking.status === "pending_approval";
  const canCancel = isActive || booking.status === "pending_payment";
  const balance = booking.priceClp - booking.amountPaidClp;

  return (
    <>
      <p className="eyebrow">
        <span className="eyebrow-dot" />
        Reserva {publicId}
      </p>
      <h1 className="page-title" style={{ fontSize: "clamp(2rem, 4vw, 3.2rem)" }}>
        {booking.serviceName}
      </h1>

      <div className="notice" data-tone={status.tone === "ok" ? undefined : status.tone}>
        {status.tone === "ok" ? <CheckCircle2 size={18} /> : status.tone === "error" ? <XCircle size={18} /> : <Clock3 size={18} />}
        <span>
          <strong style={{ color: "var(--paper)" }}>{status.label}.</strong> {status.detail}
        </span>
      </div>

      <div className="panel" style={{ marginTop: "1.6rem" }}>
        <div className="summary-row">
          <span>Fecha</span>
          <strong style={{ textTransform: "capitalize" }}>{formatBusinessDate(startsAt)}</strong>
        </div>
        <div className="summary-row">
          <span>Hora</span>
          <strong>{formatBusinessTime(startsAt)} h</strong>
        </div>
        <div className="summary-row">
          <span>Duración</span>
          <strong>{formatDuration(booking.durationMin)}</strong>
        </div>
        <div className="summary-row">
          <span>A nombre de</span>
          <strong>{booking.customerName}</strong>
        </div>
        {booking.priceClp > 0 ? (
          <>
            <div className="summary-row">
              <span>Valor</span>
              <strong>{formatClp(booking.priceClp)}</strong>
            </div>
            {booking.amountPaidClp > 0 && balance > 0 ? (
              <div className="summary-row">
                <span>Saldo pendiente</span>
                <strong>{formatClp(balance)}</strong>
              </div>
            ) : null}
          </>
        ) : null}
      </div>

      {isActive ? (
        <div className="form-actions">
          {/* La descarga del .ics tiene su propia ruta, fuera de tRPC, para que
              el navegador y el correo puedan enlazarla directamente. */}
          <a className="primary-link" href={`/api/calendar/${publicId}.ics`}>
            <CalendarPlus size={17} /> Agregar a mi calendario
          </a>
          <Link className="ghost-link" href="/contacto">
            Necesito reagendar <ArrowUpRight size={16} />
          </Link>
        </div>
      ) : null}

      {canCancel && cancelToken && !cancelled ? (
        <div style={{ marginTop: "2.5rem", paddingTop: "1.6rem", borderTop: "1px solid var(--line)" }}>
          <p style={{ color: "var(--muted)", fontSize: ".85rem", lineHeight: 1.7, maxWidth: "480px" }}>
            {booking.status === "pending_payment"
              ? "Si ya no quieres tomar esta hora, cancélala para liberarla ahora mismo."
              : "Si ya no puedes asistir, cancela con la mayor antelación posible para que otra persona aproveche el horario."}
          </p>

          {cancelBooking.error ? (
            <div className="notice" data-tone="error" style={{ marginBottom: "1rem" }}>
              <AlertCircle size={18} />
              <span>{cancelBooking.error.message}</span>
            </div>
          ) : null}

          <button
            type="button"
            className="ghost-link"
            disabled={cancelBooking.isPending}
            onClick={() => cancelBooking.mutate({ publicId, cancelToken })}
          >
            {cancelBooking.isPending ? (
              <>
                <Loader2 size={16} className="animate-spin" /> Cancelando…
              </>
            ) : (
              "Cancelar mi cita"
            )}
          </button>
        </div>
      ) : null}

      {cancelled ? (
        <div className="notice" style={{ marginTop: "1.6rem" }}>
          <CheckCircle2 size={18} />
          <span>Tu cita fue cancelada. Te enviamos la confirmación por correo.</span>
        </div>
      ) : null}
    </>
  );
}
