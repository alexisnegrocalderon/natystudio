"use client";

import { Loader2, Trash2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { fromSantiagoInput, toSantiagoInput } from "@/lib/santiago";
import { trpc } from "@/lib/trpc";

export type EditableAppointment = {
  id: number;
  status: string;
  startsAt: string | Date;
  customerName: string;
  customerEmail: string;
  customerPhone: string;
  customerNotes: string | null;
  adminNotes: string | null;
  serviceName: string;
};

const STATUS_OPTIONS = [
  { value: "pending_approval", label: "Por confirmar" },
  { value: "confirmed", label: "Confirmada" },
  { value: "completed", label: "Realizada" },
  { value: "no_show", label: "No asistió" },
  { value: "cancelled", label: "Cancelada" },
] as const;

/**
 * Editor de una reserva dentro de la agenda: cambiar fecha y hora, corregir los datos de la clienta, ajustar
 * el estado, escribir notas o borrarla. Todo desde un solo lugar, sin salir de la semana que se está viendo.
 */
export function AppointmentEditor({ item, onClose }: { item: EditableAppointment; onClose: () => void }) {
  const utils = trpc.useUtils();
  const startsAt = new Date(item.startsAt);
  const initialStart = toSantiagoInput(startsAt);

  const [when, setWhen] = useState(initialStart);
  const [status, setStatus] = useState(item.status);
  const [name, setName] = useState(item.customerName);
  const [phone, setPhone] = useState(item.customerPhone);
  const [email, setEmail] = useState(item.customerEmail);
  const [customerNotes, setCustomerNotes] = useState(item.customerNotes ?? "");
  const [adminNotes, setAdminNotes] = useState(item.adminNotes ?? "");

  const reschedule = trpc.admin.appointments.reschedule.useMutation();
  const update = trpc.admin.appointments.update.useMutation();
  const remove = trpc.admin.appointments.delete.useMutation({
    onSuccess: () => {
      toast.success("Reserva eliminada.");
      void utils.admin.invalidate();
      onClose();
    },
    onError: error => toast.error(error.message),
  });

  const holdingPayment = item.status === "pending_payment";
  const changedTime = when !== initialStart;
  const busy = reschedule.isPending || update.isPending || remove.isPending;

  async function save() {
    try {
      if (changedTime) {
        const instant = fromSantiagoInput(when);
        if (!instant) {
          toast.error("Escribe una fecha y hora válidas.");
          return;
        }
        await reschedule.mutateAsync({ id: item.id, startsAt: instant.toISOString() });
      }
      await update.mutateAsync({
        id: item.id,
        customerName: name,
        customerEmail: email,
        customerPhone: phone,
        customerNotes,
        adminNotes,
        // Una reserva que espera pago conserva su estado: lo cierra el pago, no la edición.
        status: holdingPayment ? undefined : (status as (typeof STATUS_OPTIONS)[number]["value"]),
      });
      toast.success(changedTime ? "Reserva actualizada. Se avisó a la clienta del cambio de hora." : "Reserva actualizada.");
      void utils.admin.invalidate();
      onClose();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "No se pudo guardar.");
      // Si la hora ya se movió pero lo demás falló, se refresca para mostrar lo que sí quedó.
      void utils.admin.invalidate();
    }
  }

  return (
    <div style={{ padding: "1rem 0 .4rem", display: "grid", gap: "1rem" }}>
      <div className="field-row">
        <div className="field">
          <label htmlFor={`cuando-${item.id}`}>Fecha y hora (hora de Chile)</label>
          <input
            id={`cuando-${item.id}`}
            type="datetime-local"
            value={when}
            onChange={event => setWhen(event.target.value)}
            style={{ colorScheme: "light" }}
          />
          <p style={{ fontSize: ".74rem", color: "var(--muted)", margin: 0 }}>
            {changedTime
              ? "Al guardar se le avisa a la clienta por correo y se reprograman sus recordatorios."
              : `Servicio: ${item.serviceName}`}
          </p>
        </div>
        <div className="field">
          <label htmlFor={`estado-${item.id}`}>Estado</label>
          {holdingPayment ? (
            <input id={`estado-${item.id}`} value="Esperando pago" disabled readOnly />
          ) : (
            <select id={`estado-${item.id}`} value={status} onChange={event => setStatus(event.target.value)}>
              {STATUS_OPTIONS.map(option => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          )}
          <p style={{ fontSize: ".74rem", color: "var(--muted)", margin: 0 }}>
            Confirmar o cancelar desde aquí también le avisa a la clienta.
          </p>
        </div>
      </div>

      <div className="field-row">
        <div className="field">
          <label htmlFor={`nombre-${item.id}`}>Nombre</label>
          <input id={`nombre-${item.id}`} value={name} onChange={event => setName(event.target.value)} />
        </div>
        <div className="field">
          <label htmlFor={`telefono-${item.id}`}>Teléfono</label>
          <input id={`telefono-${item.id}`} value={phone} onChange={event => setPhone(event.target.value)} />
        </div>
        <div className="field">
          <label htmlFor={`correo-${item.id}`}>Correo</label>
          <input id={`correo-${item.id}`} type="email" value={email} onChange={event => setEmail(event.target.value)} />
        </div>
      </div>
      <p style={{ fontSize: ".74rem", color: "var(--muted)", margin: "-.4rem 0 0" }}>
        Los datos de contacto se corrigen en la ficha de la clienta, así que cambian también en sus otras reservas.
      </p>

      <div className="field-row">
        <div className="field">
          <label htmlFor={`nota-clienta-${item.id}`}>Lo que escribió la clienta</label>
          <textarea
            id={`nota-clienta-${item.id}`}
            rows={3}
            value={customerNotes}
            onChange={event => setCustomerNotes(event.target.value)}
          />
        </div>
        <div className="field">
          <label htmlFor={`nota-interna-${item.id}`}>Notas internas (solo las ves tú)</label>
          <textarea
            id={`nota-interna-${item.id}`}
            rows={3}
            value={adminNotes}
            onChange={event => setAdminNotes(event.target.value)}
          />
        </div>
      </div>

      <div className="form-actions" style={{ justifyContent: "space-between", flexWrap: "wrap", gap: ".6rem" }}>
        <div style={{ display: "flex", gap: ".5rem", flexWrap: "wrap" }}>
          <button type="button" className="primary-link" onClick={() => void save()} disabled={busy}>
            {update.isPending || reschedule.isPending ? <Loader2 size={16} className="animate-spin" /> : null}
            Guardar cambios
          </button>
          <button type="button" className="mini-button" onClick={onClose} disabled={busy}>
            Cerrar
          </button>
        </div>
        <button
          type="button"
          className="mini-button"
          data-variant="danger"
          disabled={busy}
          onClick={() => {
            if (
              confirm(
                `¿Eliminar la reserva de ${item.customerName}? Se borra sin dejar rastro y sin avisarle a la clienta. Si quieres avisarle, usa "Cancelar" en su lugar.`,
              )
            ) {
              remove.mutate({ id: item.id });
            }
          }}
        >
          <Trash2 size={13} /> Eliminar reserva
        </button>
      </div>
    </div>
  );
}
