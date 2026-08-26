import { z } from "zod";
import { APPOINTMENT_STATUSES, SERVICE_KINDS } from "./constants";

/** Acepta formatos chilenos habituales (+56 9 1234 5678, 912345678, 22 123 4567)
 * y guarda sólo los dígitos con prefijo. La validación es deliberadamente
 * tolerante: rechazar un teléfono real cuesta una reserva perdida. */
export const phoneSchema = z
  .string()
  .trim()
  .min(8, "El teléfono es demasiado corto")
  .max(20, "El teléfono es demasiado largo")
  .refine(value => /^[+\d\s()-]+$/.test(value), "El teléfono contiene caracteres no válidos")
  .transform(value => value.replace(/[\s()-]/g, ""));

export const customerInputSchema = z.object({
  name: z.string().trim().min(2, "Necesitamos tu nombre").max(120),
  email: z.email("Revisa tu correo electrónico").trim().toLowerCase().max(320),
  phone: phoneSchema,
  notes: z.string().trim().max(1000).optional(),
});
export type CustomerInput = z.infer<typeof customerInputSchema>;

export const availabilityQuerySchema = z.object({
  serviceId: z.number().int().positive(),
  /** Día inicial y final del rango consultado, en formato YYYY-MM-DD y en hora de Chile. */
  from: z.iso.date(),
  to: z.iso.date(),
});

export const createBookingSchema = z.object({
  serviceId: z.number().int().positive(),
  /** Instante exacto de inicio en UTC (ISO 8601). Lo entrega `availability.getSlots`. */
  startsAt: z.iso.datetime(),
  customer: customerInputSchema,
});
export type CreateBookingInput = z.infer<typeof createBookingSchema>;

export const leadCaptureSchema = z.object({
  email: z.email().trim().toLowerCase().max(320),
  phone: phoneSchema.optional(),
  name: z.string().trim().max(120).optional(),
  serviceId: z.number().int().positive().optional(),
  step: z.string().trim().max(40),
});

export const contactFormSchema = z.object({
  name: z.string().trim().min(2).max(120),
  email: z.email("Revisa tu correo electrónico").trim().toLowerCase().max(320),
  phone: phoneSchema.optional(),
  message: z.string().trim().min(5, "Cuéntanos un poco más").max(2000),
  serviceId: z.number().int().positive().optional(),
  /** Campo trampa invisible: si un bot lo rellena, se descarta en silencio. */
  honeypot: z.string().max(200).optional(),
});

export const bookingLookupSchema = z.object({
  publicId: z.string().trim().min(6).max(32),
});

export const cancelBookingSchema = bookingLookupSchema.extend({
  /** Token que viaja en el enlace del correo; evita que un tercero cancele adivinando el publicId. */
  cancelToken: z.string().trim().min(10).max(64),
});

/* ------------------------------------------------------------------ admin */

export const serviceInputSchema = z.object({
  slug: z
    .string()
    .trim()
    .min(2)
    .max(80)
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Usa sólo minúsculas, números y guiones"),
  name: z.string().trim().min(2).max(140),
  shortDescription: z.string().trim().max(400),
  longDescription: z.string().trim().max(8000).optional(),
  kind: z.enum(SERVICE_KINDS).default("service"),
  durationMin: z.number().int().min(5).max(600),
  bufferMin: z.number().int().min(0).max(240).default(0),
  priceClp: z.number().int().min(0),
  depositClp: z.number().int().min(0).default(0),
  active: z.boolean().default(true),
  sortOrder: z.number().int().min(0).default(0),
  imageUrl: z.url().max(500).optional().or(z.literal("")),
  metaTitle: z.string().trim().max(70).optional(),
  metaDescription: z.string().trim().max(160).optional(),
});
export type ServiceInput = z.infer<typeof serviceInputSchema>;

export const businessHoursInputSchema = z.object({
  entries: z
    .array(
      z.object({
        weekday: z.number().int().min(0).max(6),
        startMinute: z.number().int().min(0).max(1439),
        endMinute: z.number().int().min(1).max(1440),
      }),
    )
    .max(50)
    .refine(
      entries => entries.every(entry => entry.endMinute > entry.startMinute),
      "Cada tramo debe terminar después de empezar",
    ),
});

export const timeOffInputSchema = z
  .object({
    startsAt: z.iso.datetime(),
    endsAt: z.iso.datetime(),
    reason: z.string().trim().max(200).optional(),
  })
  .refine(value => new Date(value.endsAt) > new Date(value.startsAt), {
    message: "El bloqueo debe terminar después de empezar",
    path: ["endsAt"],
  });

export const schedulingSettingsInputSchema = z.object({
  slotGranularityMin: z.number().int().min(5).max(120),
  minLeadTimeHours: z.number().int().min(0).max(720),
  maxAdvanceDays: z.number().int().min(1).max(365),
  autoApprove: z.boolean(),
});

export const postInputSchema = z.object({
  slug: z
    .string()
    .trim()
    .min(2)
    .max(120)
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Usa sólo minúsculas, números y guiones"),
  title: z.string().trim().min(2).max(160),
  excerpt: z.string().trim().max(400),
  body: z.string().trim().min(1),
  coverImageUrl: z.url().max(500).optional().or(z.literal("")),
  metaTitle: z.string().trim().max(70).optional(),
  metaDescription: z.string().trim().max(160).optional(),
  published: z.boolean().default(false),
});

export const appointmentListQuerySchema = z.object({
  from: z.iso.datetime().optional(),
  to: z.iso.datetime().optional(),
  status: z.array(z.enum(APPOINTMENT_STATUSES)).optional(),
});

export const rescheduleAppointmentSchema = z.object({
  id: z.number().int().positive(),
  startsAt: z.iso.datetime(),
});

/* --------------------------------------------------------------- clientas */

export const customerListQuerySchema = z.object({
  search: z.string().trim().max(200).optional(),
  /** Id de la última clienta de la página anterior; se listan las siguientes. */
  cursor: z.number().int().positive().optional(),
  limit: z.number().int().min(1).max(100).default(30),
});

export const customerUpdateSchema = z.object({
  id: z.number().int().positive(),
  name: z.string().trim().min(2).max(120),
  phone: phoneSchema,
  notes: z.string().trim().max(4000).optional(),
});

export const customerSendEmailSchema = z.object({
  id: z.number().int().positive(),
  subject: z.string().trim().min(2).max(160),
  body: z.string().trim().min(2).max(8000),
});

/* ------------------------------------------------------------------- auth */

export const adminLoginSchema = z.object({
  email: z.email().trim().toLowerCase(),
  password: z.string().min(1, "Ingresa tu contraseña"),
});

export const totpVerifySchema = z.object({
  challengeId: z.string().trim().min(10),
  /** Seis dígitos del autenticador, o un código de respaldo. */
  code: z.string().trim().min(6).max(16),
});

export const totpConfirmSchema = z.object({
  code: z.string().trim().regex(/^\d{6}$/, "El código son 6 dígitos"),
});
