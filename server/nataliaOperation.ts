export const NATALIA_TIMEZONE = "America/Santiago";

export const servicePaymentModes = ["none", "deposit", "full_payment"] as const;
export type ServicePaymentMode = (typeof servicePaymentModes)[number];

export const serviceStatuses = ["active", "paused", "archived"] as const;
export type ServiceStatus = (typeof serviceStatuses)[number];

export const bookingStatuses = ["hold", "pending_payment", "confirmed", "cancelled", "attended", "no_show", "refunded", "expired"] as const;
export type BookingStatus = (typeof bookingStatuses)[number];

export const paymentStatuses = ["not_required", "pending", "approved", "rejected", "cancelled", "refunded", "sandbox"] as const;
export type PaymentStatus = (typeof paymentStatuses)[number];

export const courseStatuses = ["draft", "coming_soon", "open", "closed", "archived"] as const;
export type CourseStatus = (typeof courseStatuses)[number];

export type WeeklyScheduleRuleInput = {
  weekday: number;
  startsMinute: number;
  endsMinute: number;
  slotDurationMinutes: number;
  bufferMinutes: number;
  isEnabled: boolean;
};

export function assertOneOf<T extends readonly string[]>(value: string, allowed: T, label: string): T[number] {
  if (!allowed.includes(value)) throw new Error(`${label} no es válido.`);
  return value as T[number];
}

export function validateWeeklyScheduleRule(input: WeeklyScheduleRuleInput) {
  const integerFields = [input.weekday, input.startsMinute, input.endsMinute, input.slotDurationMinutes, input.bufferMinutes];
  if (integerFields.some((value) => !Number.isInteger(value))) throw new Error("La regla de agenda debe usar valores enteros.");
  if (input.weekday < 0 || input.weekday > 6) throw new Error("El día de la semana no es válido.");
  if (input.startsMinute < 0 || input.startsMinute > 1439 || input.endsMinute < 1 || input.endsMinute > 1440 || input.endsMinute <= input.startsMinute) {
    throw new Error("El rango horario no es válido.");
  }
  if (input.slotDurationMinutes < 10 || input.slotDurationMinutes > 360) throw new Error("La duración del cupo no es válida.");
  if (input.bufferMinutes < 0 || input.bufferMinutes > 180) throw new Error("El descanso entre cupos no es válido.");
  return input;
}

export function calculateServiceCharge(mode: ServicePaymentMode, fullPriceClp: number | null, configuredChargeClp: number | null) {
  if (mode === "none") return { required: false, amountClp: 0 };
  if (fullPriceClp === null || !Number.isInteger(fullPriceClp) || fullPriceClp <= 0) throw new Error("El precio del servicio debe ser un monto CLP válido.");
  const fullPrice = fullPriceClp as number;
  const amount = mode === "full_payment" ? fullPrice : configuredChargeClp;
  if (!Number.isInteger(amount) || amount === null || amount <= 0 || amount > fullPrice) throw new Error("La seña configurada no es válida.");
  return { required: true, amountClp: amount };
}
