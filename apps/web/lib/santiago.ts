/**
 * Conversión entre un instante y la hora de pared de Chile (America/Santiago), para los campos
 * `datetime-local` del admin. No depende de la zona del navegador: Naty ve y escribe siempre hora de Chile.
 */
const TZ = "America/Santiago";

function partsOf(date: Date): { y: number; m: number; d: number; hh: number; mm: number } {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date);
  const get = (type: string) => Number(parts.find(part => part.type === type)?.value);
  return { y: get("year"), m: get("month"), d: get("day"), hh: get("hour"), mm: get("minute") };
}

const pad = (value: number) => String(value).padStart(2, "0");

/** Instante → "YYYY-MM-DDTHH:mm" en hora de Chile (el formato de `datetime-local`). */
export function toSantiagoInput(date: Date): string {
  const { y, m, d, hh, mm } = partsOf(date);
  return `${y}-${pad(m)}-${pad(d)}T${pad(hh)}:${pad(mm)}`;
}

/** "YYYY-MM-DDTHH:mm" escrito en hora de Chile → el instante exacto. Devuelve null si el texto no es válido. */
export function fromSantiagoInput(local: string): Date | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/.exec(local);
  if (!match) return null;
  const [, y, m, d, hh, mm] = match.map(Number);
  const target = Date.UTC(y, m - 1, d, hh, mm);
  let guess = target;
  // Dos pasadas bastan para absorber el desfase (UTC-3 / UTC-4) incluso cerca de un cambio de hora.
  for (let i = 0; i < 2; i += 1) {
    const shown = partsOf(new Date(guess));
    guess += target - Date.UTC(shown.y, shown.m - 1, shown.d, shown.hh, shown.mm);
  }
  const result = new Date(guess);
  return Number.isNaN(result.getTime()) ? null : result;
}
