"use client";

import { ChevronLeft, ChevronRight, Loader2 } from "lucide-react";
import { useMemo, useState } from "react";
import {
  addMonths,
  businessToday,
  daysInMonth,
  firstWeekdayOfMonth,
  formatDay,
  isBefore,
  monthLabel,
  parseDay,
  WEEKDAY_SHORT,
} from "@/lib/dates";
import { trpc } from "@/lib/trpc";

type Props = {
  serviceId: number;
  locationId: number;
  selectedDay: string | null;
  onSelectDay: (day: string) => void;
  /** Último día reservable, según la ventana configurada en el panel. */
  maxDay: string;
};

export function AvailabilityCalendar({ serviceId, locationId, selectedDay, onSelectDay, maxDay }: Props) {
  const today = businessToday();
  const initial = parseDay(selectedDay ?? today);
  const [cursor, setCursor] = useState({ year: initial.year, month: initial.month - 1 });

  const totalDays = daysInMonth(cursor.year, cursor.month);
  const from = formatDay(cursor.year, cursor.month + 1, 1);
  const to = formatDay(cursor.year, cursor.month + 1, totalDays);

  // Se consulta el mes completo de una vez: así el calendario puede mostrar la
  // disponibilidad real de cada día en lugar de obligar a probar uno por uno.
  const { data, isLoading } = trpc.availability.getSlots.useQuery(
    { serviceId, locationId, from, to },
    { enabled: serviceId > 0 && locationId > 0 },
  );

  const slotCountByDay = useMemo(() => {
    const map = new Map<string, number>();
    for (const day of data ?? []) map.set(day.date, day.slots.length);
    return map;
  }, [data]);

  const leadingBlanks = firstWeekdayOfMonth(cursor.year, cursor.month);
  const canGoBack = !isBefore(formatDay(cursor.year, cursor.month + 1, totalDays), today);
  const canGoForward = isBefore(from, maxDay);

  return (
    <div>
      <div className="calendar-head">
        <p>{monthLabel(cursor.year, cursor.month)}</p>
        <div className="calendar-nav">
          <button
            type="button"
            onClick={() => setCursor(addMonths(cursor.year, cursor.month, -1))}
            disabled={!canGoBack}
            aria-label="Mes anterior"
          >
            <ChevronLeft size={17} />
          </button>
          <button
            type="button"
            onClick={() => setCursor(addMonths(cursor.year, cursor.month, 1))}
            disabled={!canGoForward}
            aria-label="Mes siguiente"
          >
            <ChevronRight size={17} />
          </button>
        </div>
      </div>

      <div className="day-grid" role="grid" aria-label="Días disponibles">
        {WEEKDAY_SHORT.map(name => (
          <div className="day-name" key={name} role="columnheader">
            {name}
          </div>
        ))}

        {Array.from({ length: leadingBlanks }, (_, index) => (
          <div key={`blank-${index}`} aria-hidden="true" />
        ))}

        {Array.from({ length: totalDays }, (_, index) => {
          const dayNumber = index + 1;
          const day = formatDay(cursor.year, cursor.month + 1, dayNumber);
          const count = slotCountByDay.get(day) ?? 0;
          const inRange = !isBefore(day, today) && !isBefore(maxDay, day);
          const disabled = !inRange || count === 0;

          return (
            <button
              key={day}
              type="button"
              className="day-cell"
              disabled={disabled}
              aria-pressed={selectedDay === day}
              aria-label={
                disabled ? `${dayNumber}, sin horarios disponibles` : `${dayNumber}, ${count} horarios disponibles`
              }
              onClick={() => onSelectDay(day)}
            >
              {dayNumber}
              {/* Un punto por cada horario libre, hasta tres: da una señal de
                  escasez que se corresponde con la disponibilidad real. */}
              {count > 0 ? (
                <span className="day-load" aria-hidden="true">
                  {Array.from({ length: Math.min(count, 3) }, (_, dot) => (
                    <i key={dot} />
                  ))}
                </span>
              ) : null}
            </button>
          );
        })}
      </div>

      {isLoading ? (
        <p
          style={{
            display: "flex",
            alignItems: "center",
            gap: ".5rem",
            marginTop: "1rem",
            color: "var(--muted)",
            fontSize: ".82rem",
          }}
        >
          <Loader2 size={15} className="animate-spin" /> Buscando horarios disponibles…
        </p>
      ) : null}
    </div>
  );
}
