"use client";

import { CalendarOff, Info, Loader2, Pencil, Plus, Trash2 } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import {
  formatBusinessDate,
  formatBusinessDateTime,
  labelToMinutes,
  minutesToLabel,
  WEEKDAY_LABELS,
} from "@naty/shared";
import { addDaysToDay, businessToday } from "@/lib/dates";
import { trpc } from "@/lib/trpc";

type DayRow = { enabled: boolean; start: string; end: string };

const DEFAULT_ROW: DayRow = { enabled: false, start: "10:00", end: "19:00" };

type TimeRange = { start: string; end: string };

const EMPTY_RANGE: TimeRange = { start: "10:00", end: "13:00" };

/** Días a futuro que se traen para mostrar la lista de excepciones ya cargadas. */
const OVERRIDE_WINDOW_DAYS = 180;

export default function AdminHoursPage() {
  const utils = trpc.useUtils();
  const { data: locationList } = trpc.catalog.listLocations.useQuery();
  const [locationId, setLocationId] = useState<number | null>(null);

  // Apenas llegan las sedes, se para en la primera si todavía no hay ninguna
  // elegida — evita un estado "sin sede" que no tiene sentido en esta página.
  useEffect(() => {
    if (locationId === null && locationList && locationList.length > 0) {
      setLocationId(locationList[0].id);
    }
  }, [locationId, locationList]);

  const { data: hours, isLoading } = trpc.admin.schedule.getHours.useQuery(
    { locationId: locationId ?? 0 },
    { enabled: locationId !== null },
  );
  const { data: blocks } = trpc.admin.schedule.listTimeOff.useQuery(
    { locationId: locationId ?? 0 },
    { enabled: locationId !== null },
  );

  const [rows, setRows] = useState<DayRow[]>(() => WEEKDAY_LABELS.map(() => ({ ...DEFAULT_ROW })));
  const [blockStart, setBlockStart] = useState("");
  const [blockEnd, setBlockEnd] = useState("");
  const [blockReason, setBlockReason] = useState("");

  // Sólo se sincroniza cuando llegan los datos del servidor (o cambia la
  // sede elegida); después el estado local manda para no pisar lo que Naty
  // está editando.
  useEffect(() => {
    const next = WEEKDAY_LABELS.map(() => ({ ...DEFAULT_ROW }));
    for (const entry of hours ?? []) {
      next[entry.weekday] = {
        enabled: true,
        start: minutesToLabel(entry.startMinute),
        end: minutesToLabel(entry.endMinute),
      };
    }
    setRows(next);
  }, [hours]);

  const saveHours = trpc.admin.schedule.setHours.useMutation({
    onSuccess: () => {
      toast.success("Horario comercial guardado.");
      void utils.admin.schedule.getHours.invalidate();
    },
    onError: error => toast.error(error.message),
  });

  const createBlock = trpc.admin.schedule.createTimeOff.useMutation({
    onSuccess: () => {
      toast.success("Bloqueo agregado.");
      setBlockStart("");
      setBlockEnd("");
      setBlockReason("");
      void utils.admin.schedule.listTimeOff.invalidate();
    },
    onError: error => toast.error(error.message),
  });

  const deleteBlock = trpc.admin.schedule.deleteTimeOff.useMutation({
    onSuccess: () => {
      toast.success("Bloqueo eliminado.");
      void utils.admin.schedule.listTimeOff.invalidate();
    },
    onError: error => toast.error(error.message),
  });

  // Excepciones por fecha: para sedes sin horario fijo, Naty abre horas
  // sueltas día por día en vez de mantener una plantilla semanal.
  const today = businessToday();
  const overridesTo = addDaysToDay(today, OVERRIDE_WINDOW_DAYS);

  const { data: overrides } = trpc.admin.schedule.listDateOverrides.useQuery(
    { locationId: locationId ?? 0, from: today, to: overridesTo },
    { enabled: locationId !== null },
  );

  const [overrideDay, setOverrideDay] = useState("");
  const [overrideRanges, setOverrideRanges] = useState<TimeRange[]>([]);

  const overridesByDay = new Map<string, { startMinute: number; endMinute: number }[]>();
  for (const entry of overrides ?? []) {
    const list = overridesByDay.get(entry.day) ?? [];
    list.push(entry);
    overridesByDay.set(entry.day, list);
  }
  const upcomingOverrideDays = [...overridesByDay.keys()].sort();

  const saveOverride = trpc.admin.schedule.setDayOverride.useMutation({
    onSuccess: () => {
      toast.success("Horario del día guardado.");
      void utils.admin.schedule.listDateOverrides.invalidate();
    },
    onError: error => toast.error(error.message),
  });

  /** Carga las excepciones ya guardadas de un día en el editor, o una fila vacía si no tiene. */
  function editOverrideDay(day: string) {
    setOverrideDay(day);
    const existing = overridesByDay.get(day);
    setOverrideRanges(
      existing && existing.length > 0
        ? existing.map(entry => ({ start: minutesToLabel(entry.startMinute), end: minutesToLabel(entry.endMinute) }))
        : [{ ...EMPTY_RANGE }],
    );
  }

  function submitOverride() {
    if (!locationId || !overrideDay) return;

    const entries = overrideRanges.map(range => ({
      startMinute: labelToMinutes(range.start),
      endMinute: labelToMinutes(range.end),
    }));

    const invalid = entries.find(entry => entry.endMinute <= entry.startMinute);
    if (invalid) {
      toast.error("Cada tramo debe terminar después de empezar.");
      return;
    }

    saveOverride.mutate(
      { locationId, day: overrideDay, entries },
      {
        onSuccess: () => {
          setOverrideDay("");
          setOverrideRanges([]);
        },
      },
    );
  }

  function submitHours() {
    if (!locationId) return;

    const entries = rows
      .map((row, weekday) => ({ row, weekday }))
      .filter(({ row }) => row.enabled)
      .map(({ row, weekday }) => ({
        weekday,
        startMinute: labelToMinutes(row.start),
        endMinute: labelToMinutes(row.end),
      }));

    const invalid = entries.find(entry => entry.endMinute <= entry.startMinute);
    if (invalid) {
      toast.error(`${WEEKDAY_LABELS[invalid.weekday]}: la hora de cierre debe ser posterior a la de apertura.`);
      return;
    }

    saveHours.mutate({ locationId, entries });
  }

  return (
    <>
      <div className="admin-header">
        <div>
          <h1>Horarios</h1>
          <p>Define el horario de cada sede y bloquea los días que no atiendes ahí.</p>
        </div>
      </div>

      {locationList && locationList.length > 1 ? (
        <div className="admin-nav" style={{ position: "static", gridAutoFlow: "column", gridAutoColumns: "max-content", marginBottom: "1.5rem" }}>
          {locationList.map(item => (
            <button
              key={item.id}
              type="button"
              className="mini-button"
              data-variant={locationId === item.id ? "primary" : undefined}
              onClick={() => setLocationId(item.id)}
            >
              {item.name}
            </button>
          ))}
        </div>
      ) : null}

      <section className="admin-card">
        <h2>Horario semanal</h2>

        {isLoading || locationId === null ? (
          <p style={{ color: "var(--muted)", display: "flex", gap: ".6rem", alignItems: "center" }}>
            <Loader2 size={16} className="animate-spin" /> Cargando…
          </p>
        ) : (
          <>
            {WEEKDAY_LABELS.map((label, weekday) => (
              <div className="hours-row" key={label}>
                <label htmlFor={`dia-${weekday}`}>{label}</label>
                <input
                  type="time"
                  aria-label={`Apertura ${label}`}
                  value={rows[weekday].start}
                  disabled={!rows[weekday].enabled}
                  onChange={event =>
                    setRows(current =>
                      current.map((row, index) =>
                        index === weekday ? { ...row, start: event.target.value } : row,
                      ),
                    )
                  }
                />
                <input
                  type="time"
                  aria-label={`Cierre ${label}`}
                  value={rows[weekday].end}
                  disabled={!rows[weekday].enabled}
                  onChange={event =>
                    setRows(current =>
                      current.map((row, index) =>
                        index === weekday ? { ...row, end: event.target.value } : row,
                      ),
                    )
                  }
                />
                <input
                  id={`dia-${weekday}`}
                  type="checkbox"
                  aria-label={`Atiendo los ${label}`}
                  checked={rows[weekday].enabled}
                  onChange={event =>
                    setRows(current =>
                      current.map((row, index) =>
                        index === weekday ? { ...row, enabled: event.target.checked } : row,
                      ),
                    )
                  }
                />
              </div>
            ))}

            <div className="form-actions">
              <button type="button" className="primary-link" onClick={submitHours} disabled={saveHours.isPending}>
                {saveHours.isPending ? <Loader2 size={16} className="animate-spin" /> : null}
                Guardar horario
              </button>
            </div>
          </>
        )}
      </section>

      <section className="admin-card">
        <h2>Horario por fecha (excepciones)</h2>

        <div className="notice" style={{ marginBottom: "1.2rem" }}>
          <Info size={18} />
          <span>
            Para sedes sin horario fijo: agrega un día puntual con sus horas y ese día usa sólo esas
            horas, sin importar lo que diga el horario semanal. Un día sin excepción sigue el horario
            semanal de siempre.
          </span>
        </div>

        <div className="field">
          <label htmlFor="fecha-excepcion">Fecha</label>
          <input
            id="fecha-excepcion"
            type="date"
            min={today}
            value={overrideDay}
            onChange={event => editOverrideDay(event.target.value)}
            style={{ colorScheme: "dark" }}
          />
        </div>

        {overrideDay ? (
          <>
            {overrideRanges.map((range, index) => (
              <div className="override-range-row" key={index}>
                <div className="field">
                  <label htmlFor={`tramo-inicio-${index}`}>Desde</label>
                  <input
                    id={`tramo-inicio-${index}`}
                    type="time"
                    value={range.start}
                    onChange={event =>
                      setOverrideRanges(current =>
                        current.map((item, i) => (i === index ? { ...item, start: event.target.value } : item)),
                      )
                    }
                  />
                </div>
                <div className="field">
                  <label htmlFor={`tramo-fin-${index}`}>Hasta</label>
                  <input
                    id={`tramo-fin-${index}`}
                    type="time"
                    value={range.end}
                    onChange={event =>
                      setOverrideRanges(current =>
                        current.map((item, i) => (i === index ? { ...item, end: event.target.value } : item)),
                      )
                    }
                  />
                </div>
                {overrideRanges.length > 1 ? (
                  <button
                    type="button"
                    className="mini-button"
                    data-variant="danger"
                    onClick={() => setOverrideRanges(current => current.filter((_, i) => i !== index))}
                  >
                    <Trash2 size={13} />
                  </button>
                ) : null}
              </div>
            ))}

            <div className="form-actions">
              <button
                type="button"
                className="mini-button"
                onClick={() => setOverrideRanges(current => [...current, { ...EMPTY_RANGE }])}
              >
                <Plus size={13} style={{ display: "inline", marginRight: ".3rem" }} />
                Agregar otro tramo
              </button>
              <button
                type="button"
                className="primary-link"
                onClick={submitOverride}
                disabled={saveOverride.isPending}
              >
                {saveOverride.isPending ? <Loader2 size={16} className="animate-spin" /> : null}
                Guardar ese día
              </button>
            </div>
          </>
        ) : null}

        {upcomingOverrideDays.length > 0 ? (
          <div className="table-scroll" style={{ marginTop: "1.5rem", border: 0, background: "transparent" }}>
            <table className="data-table">
              <thead>
                <tr>
                  <th>Día</th>
                  <th>Horas</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {upcomingOverrideDays.map(day => (
                  <tr key={day}>
                    <td style={{ textTransform: "capitalize" }}>
                      {formatBusinessDate(new Date(`${day}T12:00:00Z`))}
                    </td>
                    <td>
                      {(overridesByDay.get(day) ?? [])
                        .map(entry => `${minutesToLabel(entry.startMinute)}–${minutesToLabel(entry.endMinute)}`)
                        .join(", ")}
                    </td>
                    <td>
                      <div className="row-actions">
                        <button type="button" className="mini-button" onClick={() => editOverrideDay(day)}>
                          <Pencil size={13} />
                        </button>
                        <button
                          type="button"
                          className="mini-button"
                          data-variant="danger"
                          onClick={() => {
                            if (!locationId) return;
                            saveOverride.mutate({ locationId, day, entries: [] });
                          }}
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p style={{ marginTop: "1.5rem", color: "var(--muted)", fontSize: ".85rem", display: "flex", gap: ".5rem" }}>
            <CalendarOff size={16} /> No hay excepciones cargadas.
          </p>
        )}
      </section>

      <section className="admin-card">
        <h2>Bloqueos y vacaciones</h2>

        <div className="notice" style={{ marginBottom: "1.2rem" }}>
          <Info size={18} />
          <span>
            Un bloqueo saca esas horas de la agenda pública. Las citas ya confirmadas dentro del rango no
            se cancelan solas: revísalas en la agenda.
          </span>
        </div>

        <div className="field-row">
          <div className="field">
            <label htmlFor="desde">Desde</label>
            <input
              id="desde"
              type="datetime-local"
              value={blockStart}
              onChange={event => setBlockStart(event.target.value)}
              style={{ colorScheme: "dark" }}
            />
          </div>
          <div className="field">
            <label htmlFor="hasta">Hasta</label>
            <input
              id="hasta"
              type="datetime-local"
              value={blockEnd}
              onChange={event => setBlockEnd(event.target.value)}
              style={{ colorScheme: "dark" }}
            />
          </div>
        </div>

        <div className="field">
          <label htmlFor="motivo">Motivo (opcional)</label>
          <input
            id="motivo"
            value={blockReason}
            onChange={event => setBlockReason(event.target.value)}
            placeholder="Vacaciones, curso, feriado…"
          />
        </div>

        <button
          type="button"
          className="mini-button"
          data-variant="primary"
          disabled={!blockStart || !blockEnd || !locationId || createBlock.isPending}
          onClick={() => {
            if (!locationId) return;
            createBlock.mutate({
              locationId,
              // El navegador entrega la hora local del equipo; se convierte a
              // instante absoluto antes de enviarla.
              startsAt: new Date(blockStart).toISOString(),
              endsAt: new Date(blockEnd).toISOString(),
              reason: blockReason || undefined,
            });
          }}
        >
          <Plus size={13} style={{ display: "inline", marginRight: ".3rem" }} />
          Agregar bloqueo
        </button>

        {blocks && blocks.length > 0 ? (
          <div className="table-scroll" style={{ marginTop: "1.5rem", border: 0, background: "transparent" }}>
            <table className="data-table">
              <thead>
                <tr>
                  <th>Desde</th>
                  <th>Hasta</th>
                  <th>Motivo</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {blocks.map(block => (
                  <tr key={block.id}>
                    <td>{formatBusinessDateTime(new Date(block.startsAt))}</td>
                    <td>{formatBusinessDateTime(new Date(block.endsAt))}</td>
                    <td>{block.reason ?? "—"}</td>
                    <td>
                      <button
                        type="button"
                        className="mini-button"
                        data-variant="danger"
                        onClick={() => deleteBlock.mutate({ id: block.id })}
                      >
                        <Trash2 size={13} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p style={{ marginTop: "1.5rem", color: "var(--muted)", fontSize: ".85rem", display: "flex", gap: ".5rem" }}>
            <CalendarOff size={16} /> No hay bloqueos registrados.
          </p>
        )}
      </section>
    </>
  );
}
