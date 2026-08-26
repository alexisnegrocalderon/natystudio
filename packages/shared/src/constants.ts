/** Zona horaria operativa del negocio. Chile aplica horario de verano, así que
 * todo instante se guarda en UTC y sólo se convierte a esta zona al mostrarlo. */
export const BUSINESS_TIMEZONE = "America/Santiago";

/** Nombre de la cookie de sesión del panel de administración. */
export const ADMIN_SESSION_COOKIE = "naty_admin_session";

export const UNAUTHED_ERR_MSG = "Necesitas iniciar sesión (10001)";
export const NOT_ADMIN_ERR_MSG = "No tienes permisos para esta acción (10002)";

export const APPOINTMENT_STATUSES = [
  /** Reservada, esperando el pago. Sólo se usa con los pagos activados. */
  "pending_payment",
  /** Reservada, esperando que Naty la confirme. */
  "pending_approval",
  "confirmed",
  "cancelled",
  "completed",
  "no_show",
] as const;
export type AppointmentStatus = (typeof APPOINTMENT_STATUSES)[number];

/** Estados que ocupan el horario y por tanto participan del control de solapamiento. */
export const BLOCKING_APPOINTMENT_STATUSES = [
  "pending_payment",
  "pending_approval",
  "confirmed",
] as const satisfies readonly AppointmentStatus[];

export const SERVICE_KINDS = ["service", "course"] as const;
export type ServiceKind = (typeof SERVICE_KINDS)[number];

export const PAYMENT_KINDS = ["deposit", "full", "balance"] as const;
export type PaymentKind = (typeof PAYMENT_KINDS)[number];

export const PAYMENT_STATUSES = ["pending", "approved", "rejected", "refunded", "cancelled"] as const;
export type PaymentStatus = (typeof PAYMENT_STATUSES)[number];

export const EMAIL_JOB_KINDS = [
  "booking_received",
  "booking_confirmed",
  "reminder_24h",
  "reminder_2h",
  "rescheduled",
  "cancelled",
  "admin_new_booking",
  /** Comprobante del abono o del pago total hecho en línea. */
  "payment_received",
  /** Correo escrito a mano por Naty desde la ficha de una clienta. */
  "manual_message",
] as const;
export type EmailJobKind = (typeof EMAIL_JOB_KINDS)[number];

/** Días de la semana como los guarda `businessHours.weekday` (0 = domingo, igual que `Date#getDay`). */
export const WEEKDAY_LABELS = [
  "Domingo",
  "Lunes",
  "Martes",
  "Miércoles",
  "Jueves",
  "Viernes",
  "Sábado",
] as const;
