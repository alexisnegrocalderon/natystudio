"use client";

import { AlertCircle, ChevronLeft, ChevronRight, Loader2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { formatBusinessDate, formatBusinessTime, formatDuration } from "@naty/shared";
import { StatusPill } from "@/components/admin/StatusPill";
import { addDaysToDay, businessToday, formatDay, parseDay } from "@/lib/dates";
import { trpc } from "@/lib/trpc";

/** Convierte un día local de Chile al instante que abre y cierra ese rango. */
function rangeFor(startDay: string, days: number) {
  const { year, month, date } = parseDay(startDay);
  // Se toman márgenes amplios (un día antes y después) para no perder citas por
  // el desfase entre la fecha local y UTC.
  const from = new Date(Date.UTC(year, month - 1, date - 1));
  const to = new Date(Date.UTC(year, month - 1, date + days + 1));
  return { from: from.toISOString(), to: to.toISOString() };
}

export default function AdminAgendaPage() {
  const [weekStart, setWeekStart] = useState(businessToday());
  const utils = trpc.useUtils();

  const range = rangeFor(weekStart, 7);
  const { data: appointments, isLoading } = trpc.admin.appointments.list.useQuery(range);

  const refresh = () => utils.admin.invalidate();

  const approve = trpc.admin.appointments.approve.useMutation({
    onSuccess: () => {
      toast.success("Cita confirmada. Se envió el correo a la clienta.");
      void refresh();
    },
    onError: error => toast.error(error.message),
  });

  const cancel = trpc.admin.appointments.cancel.useMutation({
    onSuccess: () => {
      toast.success("Cita cancelada y clienta avisada.");
      void refresh();
    },
    onError: error => toast.error(error.message),
  });

  const setOutcome = trpc.admin.appointments.setOutcome.useMutation({
    onSuccess: () => {
      toast.success("Cita actualizada.");
      void refresh();
    },
    onError: error => toast.error(error.message),
  });

  const busy = approve.isPending || cancel.isPending || setOutcome.isPending;

  // Se agrupa por día para que la semana se lea como una agenda y no como una
  // lista plana.
  const byDay = new Map<string, NonNullable<typeof appointments>>();
  for (const item of appointments ?? []) {
    const day = formatBusinessDayOf(new Date(item.startsAt));
    const list = byDay.get(day) ?? [];
    list.push(item);
    byDay.set(day, list);
  }

  const days = Array.from({ length: 7 }, (_, index) => addDaysToDay(weekStart, index));

  return (
    <>
      <div className="admin-header">
        <div>
          <h1>Agenda</h1>
          <p>Confirma, mueve o cancela las citas de la semana.</p>
        </div>

        <div className="calendar-nav">
          <button type="button" onClick={() => setWeekStart(addDaysToDay(weekStart, -7))} aria-label="Semana anterior">
            <ChevronLeft size={17} />
          </button>
          <button type="button" className="mini-button" onClick={() => setWeekStart(businessToday())}>
            Hoy
          </button>
          <button type="button" onClick={() => setWeekStart(addDaysToDay(weekStart, 7))} aria-label="Semana siguiente">
            <ChevronRight size={17} />
          </button>
        </div>
      </div>

      {isLoading ? (
        <p style={{ color: "var(--muted)", display: "flex", gap: ".6rem", alignItems: "center" }}>
          <Loader2 size={17} className="animate-spin" /> Cargando la agenda…
        </p>
      ) : (
        days.map(day => {
          const items = (byDay.get(day) ?? []).sort(
            (a, b) => new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime(),
          );

          return (
            <section key={day} className="admin-card">
              <h2 style={{ textTransform: "capitalize", color: day === businessToday() ? "var(--rose)" : undefined }}>
                {formatBusinessDate(new Date(`${day}T12:00:00Z`))}
                {day === businessToday() ? " · hoy" : ""}
              </h2>

              {items.length === 0 ? (
                <p style={{ margin: 0, color: "var(--muted)", fontSize: ".85rem" }}>Sin citas.</p>
              ) : (
                <div className="table-scroll" style={{ border: 0, background: "transparent" }}>
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th>Hora</th>
                        <th>Clienta</th>
                        <th>Servicio</th>
                        <th>Estado</th>
                        <th>Acciones</th>
                      </tr>
                    </thead>
                    <tbody>
                      {items.map(item => (
                        <tr key={item.id}>
                          <td style={{ whiteSpace: "nowrap", color: "var(--paper)" }}>
                            {formatBusinessTime(new Date(item.startsAt))} h
                            <br />
                            <small style={{ color: "var(--muted)" }}>{formatDuration(item.durationMin)}</small>
                          </td>
                          <td>
                            <strong style={{ color: "var(--paper)" }}>{item.customerName}</strong>
                            <br />
                            <small style={{ color: "var(--muted)" }}>{item.customerPhone}</small>
                            <br />
                            <small style={{ color: "var(--muted)" }}>{item.customerEmail}</small>
                            {item.customerNotes ? (
                              <p
                                style={{
                                  margin: ".5rem 0 0",
                                  fontSize: ".78rem",
                                  color: "var(--rose-pale)",
                                  maxWidth: "260px",
                                  lineHeight: 1.5,
                                }}
                              >
                                “{item.customerNotes}”
                              </p>
                            ) : null}
                          </td>
                          <td>{item.serviceName}</td>
                          <td>
                            <StatusPill status={item.status} />
                          </td>
                          <td>
                            <div className="row-actions">
                              {item.status === "pending_approval" ? (
                                <button
                                  type="button"
                                  className="mini-button"
                                  data-variant="primary"
                                  disabled={busy}
                                  onClick={() => approve.mutate({ id: item.id })}
                                >
                                  Confirmar
                                </button>
                              ) : null}

                              {item.status === "confirmed" ? (
                                <>
                                  <button
                                    type="button"
                                    className="mini-button"
                                    disabled={busy}
                                    onClick={() => setOutcome.mutate({ id: item.id, status: "completed" })}
                                  >
                                    Realizada
                                  </button>
                                  <button
                                    type="button"
                                    className="mini-button"
                                    disabled={busy}
                                    onClick={() => setOutcome.mutate({ id: item.id, status: "no_show" })}
                                  >
                                    No asistió
                                  </button>
                                </>
                              ) : null}

                              {item.status === "pending_approval" || item.status === "confirmed" ? (
                                <button
                                  type="button"
                                  className="mini-button"
                                  data-variant="danger"
                                  disabled={busy}
                                  onClick={() => {
                                    if (confirm(`¿Cancelar la cita de ${item.customerName}?`)) {
                                      cancel.mutate({ id: item.id });
                                    }
                                  }}
                                >
                                  Cancelar
                                </button>
                              ) : null}
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </section>
          );
        })
      )}

      <div className="notice" style={{ marginTop: "1.5rem" }}>
        <AlertCircle size={18} />
        <span>
          Confirmar una cita envía el correo de confirmación con el archivo de calendario y programa los
          recordatorios de 24 y 2 horas antes.
        </span>
      </div>
    </>
  );
}

/** Fecha YYYY-MM-DD del instante, en hora de Chile. */
function formatBusinessDayOf(instant: Date): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Santiago",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(instant);

  const get = (type: string) => parts.find(part => part.type === type)?.value ?? "";
  return formatDay(Number(get("year")), Number(get("month")), Number(get("day")));
}
