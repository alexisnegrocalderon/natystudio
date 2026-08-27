import {
  boolean,
  doublePrecision,
  index,
  integer,
  pgEnum,
  pgTable,
  serial,
  smallint,
  text,
  timestamp,
  uniqueIndex,
  varchar,
} from "drizzle-orm/pg-core";
import {
  APPOINTMENT_STATUSES,
  EMAIL_JOB_KINDS,
  PAYMENT_KINDS,
  PAYMENT_STATUSES,
  SERVICE_KINDS,
} from "@naty/shared";

/**
 * Todas las marcas de tiempo usan `withTimezone` (timestamptz). Chile cambia la
 * hora dos veces al año: guardar instantes absolutos y convertir sólo al mostrar
 * es lo que evita que las citas se corran una hora en cada cambio.
 */
const instant = (name: string) => timestamp(name, { withTimezone: true, mode: "date" });

export const roleEnum = pgEnum("role", ["user", "admin"]);
export const serviceKindEnum = pgEnum("service_kind", SERVICE_KINDS);
export const appointmentStatusEnum = pgEnum("appointment_status", APPOINTMENT_STATUSES);
export const paymentKindEnum = pgEnum("payment_kind", PAYMENT_KINDS);
export const paymentStatusEnum = pgEnum("payment_status", PAYMENT_STATUSES);
export const emailJobKindEnum = pgEnum("email_job_kind", EMAIL_JOB_KINDS);
export const emailJobStatusEnum = pgEnum("email_job_status", ["pending", "sent", "failed"]);

/* ------------------------------------------------------------------ users */

export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  email: varchar("email", { length: 320 }).notNull().unique(),
  name: text("name"),
  role: roleEnum("role").notNull().default("user"),
  /** Hash bcrypt. Nulo mientras la cuenta no tenga contraseña asignada. */
  passwordHash: varchar("password_hash", { length: 120 }),
  /** Secreto TOTP en base32. Se guarda sólo tras confirmar el primer código. */
  totpSecret: varchar("totp_secret", { length: 120 }),
  totpEnabled: boolean("totp_enabled").notNull().default(false),
  /** Códigos de respaldo hasheados, uno por elemento. Se consumen al usarse. */
  backupCodes: text("backup_codes").array(),
  failedLoginAttempts: integer("failed_login_attempts").notNull().default(0),
  lockedUntil: instant("locked_until"),
  lastSignedIn: instant("last_signed_in"),
  createdAt: instant("created_at").notNull().defaultNow(),
  updatedAt: instant("updated_at").notNull().defaultNow(),
});

/* --------------------------------------------------------------- services */

export const services = pgTable(
  "services",
  {
    id: serial("id").primaryKey(),
    slug: varchar("slug", { length: 80 }).notNull().unique(),
    name: varchar("name", { length: 140 }).notNull(),
    shortDescription: text("short_description").notNull().default(""),
    longDescription: text("long_description"),
    kind: serviceKindEnum("kind").notNull().default("service"),
    durationMin: integer("duration_min").notNull(),
    /** Minutos de preparación/limpieza que quedan bloqueados después de la cita. */
    bufferMin: integer("buffer_min").notNull().default(0),
    /** Montos en pesos chilenos, siempre enteros: el CLP no tiene decimales. */
    priceClp: integer("price_clp").notNull().default(0),
    depositClp: integer("deposit_clp").notNull().default(0),
    active: boolean("active").notNull().default(true),
    sortOrder: integer("sort_order").notNull().default(0),
    imageUrl: varchar("image_url", { length: 500 }),
    metaTitle: varchar("meta_title", { length: 70 }),
    metaDescription: varchar("meta_description", { length: 160 }),
    createdAt: instant("created_at").notNull().defaultNow(),
    updatedAt: instant("updated_at").notNull().defaultNow(),
  },
  table => [index("services_active_sort_idx").on(table.active, table.sortOrder)],
);

/* ----------------------------------------------------------------- sedes */

/**
 * Naty atiende en más de una dirección física. `businessHours`/`timeOff`
 * cuelgan de acá porque cada sede puede tener sus propios días/horarios;
 * `appointments` también referencia una sede (para mostrarla y armar el
 * .ics), pero eso NO participa en el chequeo de solapamiento de citas —
 * sigue siendo una sola persona, no puede estar en dos sedes a la vez, así
 * que ese constraint se mantiene global entre sedes a propósito.
 */
export const locations = pgTable("locations", {
  id: serial("id").primaryKey(),
  slug: varchar("slug", { length: 60 }).notNull().unique(),
  name: varchar("name", { length: 140 }).notNull(),
  city: varchar("city", { length: 120 }).notNull(),
  region: varchar("region", { length: 120 }).notNull(),
  /** Puede quedar vacío hasta que Naty confirme la dirección exacta. */
  streetAddress: varchar("street_address", { length: 240 }).notNull().default(""),
  latitude: doublePrecision("latitude"),
  longitude: doublePrecision("longitude"),
  /** Si es nulo, el sitio usa el WhatsApp general del negocio. */
  whatsapp: varchar("whatsapp", { length: 200 }),
  /** Nota corta opcional, ej. "Atiende martes y miércoles". */
  note: varchar("note", { length: 200 }),
  active: boolean("active").notNull().default(true),
  sortOrder: integer("sort_order").notNull().default(0),
  createdAt: instant("created_at").notNull().defaultNow(),
  updatedAt: instant("updated_at").notNull().defaultNow(),
});

/* ------------------------------------------------------ horarios y bloqueos */

export const businessHours = pgTable(
  "business_hours",
  {
    id: serial("id").primaryKey(),
    locationId: integer("location_id")
      .notNull()
      .references(() => locations.id, { onDelete: "cascade" }),
    /** 0 = domingo, igual que `Date#getDay`. */
    weekday: smallint("weekday").notNull(),
    /** Minutos desde medianoche en hora de Chile. 540 = 09:00. */
    startMinute: integer("start_minute").notNull(),
    endMinute: integer("end_minute").notNull(),
    createdAt: instant("created_at").notNull().defaultNow(),
  },
  table => [index("business_hours_location_weekday_idx").on(table.locationId, table.weekday)],
);

export const timeOff = pgTable(
  "time_off",
  {
    id: serial("id").primaryKey(),
    locationId: integer("location_id")
      .notNull()
      .references(() => locations.id, { onDelete: "cascade" }),
    startsAt: instant("starts_at").notNull(),
    endsAt: instant("ends_at").notNull(),
    reason: varchar("reason", { length: 200 }),
    createdAt: instant("created_at").notNull().defaultNow(),
  },
  table => [index("time_off_range_idx").on(table.startsAt, table.endsAt)],
);

/**
 * Excepciones puntuales a la plantilla semanal de una sede: para una fecha
 * concreta con filas acá, esas filas REEMPLAZAN por completo el horario de
 * ese día (no se combinan con `businessHours`). Pensado para sedes sin
 * patrón fijo, donde Naty abre horas sueltas fecha por fecha en vez de
 * mantener un horario semanal recurrente.
 */
export const dateOverrides = pgTable(
  "date_overrides",
  {
    id: serial("id").primaryKey(),
    locationId: integer("location_id")
      .notNull()
      .references(() => locations.id, { onDelete: "cascade" }),
    /** YYYY-MM-DD en hora de Chile, mismo formato que usa el resto de la agenda. */
    day: varchar("day", { length: 10 }).notNull(),
    startMinute: integer("start_minute").notNull(),
    endMinute: integer("end_minute").notNull(),
    createdAt: instant("created_at").notNull().defaultNow(),
  },
  table => [index("date_overrides_location_day_idx").on(table.locationId, table.day)],
);

/** Fila única (id = 1) con la configuración global de la agenda. */
export const schedulingSettings = pgTable("scheduling_settings", {
  id: integer("id").primaryKey().default(1),
  /** Cada cuántos minutos se ofrece un horario de inicio. */
  slotGranularityMin: integer("slot_granularity_min").notNull().default(30),
  /** Antelación mínima para reservar, en horas. */
  minLeadTimeHours: integer("min_lead_time_hours").notNull().default(12),
  /** Hasta cuántos días hacia adelante se puede reservar. */
  maxAdvanceDays: integer("max_advance_days").notNull().default(60),
  /** Si está activo, la reserva queda confirmada sin que Naty la apruebe. */
  autoApprove: boolean("auto_approve").notNull().default(false),
  updatedAt: instant("updated_at").notNull().defaultNow(),
});

/* -------------------------------------------------------------- customers */

export const customers = pgTable("customers", {
  id: serial("id").primaryKey(),
  email: varchar("email", { length: 320 }).notNull().unique(),
  name: varchar("name", { length: 120 }).notNull(),
  phone: varchar("phone", { length: 20 }).notNull(),
  notes: text("notes"),
  createdAt: instant("created_at").notNull().defaultNow(),
  updatedAt: instant("updated_at").notNull().defaultNow(),
});

/* ----------------------------------------------------------- appointments */

export const appointments = pgTable(
  "appointments",
  {
    id: serial("id").primaryKey(),
    /** Identificador corto y no adivinable que va en las URLs públicas. */
    publicId: varchar("public_id", { length: 32 }).notNull().unique(),
    customerId: integer("customer_id")
      .notNull()
      .references(() => customers.id, { onDelete: "restrict" }),
    serviceId: integer("service_id")
      .notNull()
      .references(() => services.id, { onDelete: "restrict" }),
    /**
     * Sólo para mostrar/filtrar y armar el .ics — el chequeo de solapamiento
     * (más abajo, constraint de exclusión) es global entre sedes a propósito.
     */
    locationId: integer("location_id")
      .notNull()
      .references(() => locations.id, { onDelete: "restrict" }),
    startsAt: instant("starts_at").notNull(),
    endsAt: instant("ends_at").notNull(),
    /**
     * Fin del bloqueo real = endsAt + buffer del servicio. El constraint de
     * exclusión trabaja sobre este campo para que el tiempo de limpieza también
     * quede protegido frente a otra reserva.
     */
    blockedUntil: instant("blocked_until").notNull(),
    status: appointmentStatusEnum("status").notNull().default("pending_approval"),
    priceClp: integer("price_clp").notNull(),
    amountPaidClp: integer("amount_paid_clp").notNull().default(0),
    /** Autoriza cancelar o reagendar desde el enlace del correo. */
    cancelToken: varchar("cancel_token", { length: 64 }).notNull(),
    customerNotes: text("customer_notes"),
    adminNotes: text("admin_notes"),
    createdAt: instant("created_at").notNull().defaultNow(),
    updatedAt: instant("updated_at").notNull().defaultNow(),
  },
  table => [
    index("appointments_starts_at_idx").on(table.startsAt),
    index("appointments_status_starts_at_idx").on(table.status, table.startsAt),
    index("appointments_customer_idx").on(table.customerId),
  ],
);

/* --------------------------------------------------------------- payments */

/**
 * Creada desde ahora aunque Mercado Pago siga apagado: tener el esquema listo
 * evita una migración de datos cuando lleguen las credenciales.
 */
export const payments = pgTable(
  "payments",
  {
    id: serial("id").primaryKey(),
    appointmentId: integer("appointment_id")
      .notNull()
      .references(() => appointments.id, { onDelete: "cascade" }),
    /** Identificador del pago en Mercado Pago. Único: hace idempotente el webhook. */
    externalId: varchar("external_id", { length: 64 }).unique(),
    kind: paymentKindEnum("kind").notNull(),
    status: paymentStatusEnum("status").notNull().default("pending"),
    amountClp: integer("amount_clp").notNull(),
    rawPayload: text("raw_payload"),
    createdAt: instant("created_at").notNull().defaultNow(),
    updatedAt: instant("updated_at").notNull().defaultNow(),
  },
  table => [
    index("payments_appointment_idx").on(table.appointmentId),
    /** El reconciliador del cron busca por aquí los pagos "pending" que llevan rato sin novedad. */
    index("payments_status_updated_idx").on(table.status, table.updatedAt),
  ],
);

/* -------------------------------------------------------------- expenses */

export const expenses = pgTable(
  "expenses",
  {
    id: serial("id").primaryKey(),
    description: varchar("description", { length: 200 }).notNull(),
    amountClp: integer("amount_clp").notNull(),
    /** Texto libre (arriendo, insumos, marketing, otro...): sólo agrupa en la
     *  vista de Ventas, no hay lógica de negocio atada a categorías fijas. */
    category: varchar("category", { length: 60 }).notNull().default("otro"),
    /** Nulo si el gasto no es de una sede en particular (ej. marketing general). */
    locationId: integer("location_id").references(() => locations.id, { onDelete: "set null" }),
    incurredAt: instant("incurred_at").notNull(),
    createdAt: instant("created_at").notNull().defaultNow(),
  },
  table => [index("expenses_incurred_at_idx").on(table.incurredAt)],
);

/* -------------------------------------------------------------- emailJobs */

export const emailJobs = pgTable(
  "email_jobs",
  {
    id: serial("id").primaryKey(),
    appointmentId: integer("appointment_id").references(() => appointments.id, {
      onDelete: "cascade",
    }),
    kind: emailJobKindEnum("kind").notNull(),
    recipient: varchar("recipient", { length: 320 }).notNull(),
    scheduledFor: instant("scheduled_for").notNull(),
    sentAt: instant("sent_at"),
    status: emailJobStatusEnum("status").notNull().default("pending"),
    attempts: integer("attempts").notNull().default(0),
    lastError: text("last_error"),
    /**
     * Asunto y cuerpo en JSON para los correos que no nacen de una cita (mensajes
     * manuales o campañas desde la ficha de una clienta). Nulo para el resto.
     */
    payload: text("payload"),
    createdAt: instant("created_at").notNull().defaultNow(),
  },
  table => [
    index("email_jobs_pending_idx").on(table.status, table.scheduledFor),
    /** Un mismo aviso no se encola dos veces para la misma cita. */
    uniqueIndex("email_jobs_appointment_kind_key").on(table.appointmentId, table.kind),
  ],
);

/* ------------------------------------------------------------------ posts */

export const posts = pgTable(
  "posts",
  {
    id: serial("id").primaryKey(),
    slug: varchar("slug", { length: 120 }).notNull().unique(),
    title: varchar("title", { length: 160 }).notNull(),
    excerpt: text("excerpt").notNull().default(""),
    body: text("body").notNull(),
    coverImageUrl: varchar("cover_image_url", { length: 500 }),
    metaTitle: varchar("meta_title", { length: 70 }),
    metaDescription: varchar("meta_description", { length: 160 }),
    publishedAt: instant("published_at"),
    createdAt: instant("created_at").notNull().defaultNow(),
    updatedAt: instant("updated_at").notNull().defaultNow(),
  },
  table => [index("posts_published_idx").on(table.publishedAt)],
);

/* ------------------------------------------------------------------ leads */

export const leads = pgTable(
  "leads",
  {
    id: serial("id").primaryKey(),
    email: varchar("email", { length: 320 }).notNull(),
    name: varchar("name", { length: 120 }),
    phone: varchar("phone", { length: 20 }),
    serviceId: integer("service_id").references(() => services.id, { onDelete: "set null" }),
    /** Último paso del embudo alcanzado antes de abandonar. */
    step: varchar("step", { length: 40 }).notNull(),
    convertedAt: instant("converted_at"),
    createdAt: instant("created_at").notNull().defaultNow(),
  },
  table => [
    index("leads_email_idx").on(table.email),
    /**
     * Misma persona interesada en el mismo servicio: se actualiza el registro en
     * vez de acumular una fila nueva cada vez que retoma el embudo.
     */
    uniqueIndex("leads_email_service_key").on(table.email, table.serviceId),
  ],
);

/* ------------------------------------------------------- sesiones de login */

/** Desafío intermedio entre la contraseña correcta y el segundo factor. */
export const totpChallenges = pgTable("totp_challenges", {
  id: varchar("id", { length: 40 }).primaryKey(),
  userId: integer("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  expiresAt: instant("expires_at").notNull(),
  createdAt: instant("created_at").notNull().defaultNow(),
});

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;
export type Service = typeof services.$inferSelect;
export type InsertService = typeof services.$inferInsert;
export type Appointment = typeof appointments.$inferSelect;
export type InsertAppointment = typeof appointments.$inferInsert;
export type Location = typeof locations.$inferSelect;
export type Customer = typeof customers.$inferSelect;
export type BusinessHour = typeof businessHours.$inferSelect;
export type TimeOff = typeof timeOff.$inferSelect;
export type DateOverride = typeof dateOverrides.$inferSelect;
export type Expense = typeof expenses.$inferSelect;
export type SchedulingSettings = typeof schedulingSettings.$inferSelect;
export type Post = typeof posts.$inferSelect;
export type EmailJob = typeof emailJobs.$inferSelect;
