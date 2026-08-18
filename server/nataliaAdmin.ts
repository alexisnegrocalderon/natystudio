import { createHash, randomBytes, scrypt as scryptCallback, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";
import { neon } from "@neondatabase/serverless";
import { assertOneOf, bookingStatuses, courseStatuses, servicePaymentModes, serviceStatuses, validateWeeklyScheduleRule, type BookingStatus, type CourseStatus, type ServicePaymentMode, type ServiceStatus, type WeeklyScheduleRuleInput } from "./nataliaOperation";

const scrypt = promisify(scryptCallback);
const SESSION_TTL_SECONDS = 60 * 60 * 12;

export type NataliaAdminUser = {
  id: number;
  email: string;
  role: "owner" | "manager";
};

function getSql() {
  const connectionString = process.env.NEON_DATABASE_URL;
  if (!connectionString) throw new Error("La conexión Neon del portal no está configurada.");
  return neon(connectionString);
}

function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

function tokenHash(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

export async function hashPortalPassword(password: string) {
  if (password.length < 12) throw new Error("La contraseña debe tener al menos 12 caracteres.");
  const salt = randomBytes(16).toString("hex");
  const derived = (await scrypt(password, salt, 64)) as Buffer;
  return `${salt}:${derived.toString("hex")}`;
}

export async function verifyPortalPassword(password: string, stored: string) {
  const [salt, hash] = stored.split(":");
  if (!salt || !hash) return false;
  const derived = (await scrypt(password, salt, 64)) as Buffer;
  const expected = Buffer.from(hash, "hex");
  return expected.length === derived.length && timingSafeEqual(expected, derived);
}

export async function seedNataliaAdminUser(email: string, password: string) {
  const sql = getSql();
  const passwordHash = await hashPortalPassword(password);
  const [user] = await sql`
    INSERT INTO pilot_admin_users (email, password_hash, role, is_active)
    VALUES (${normalizeEmail(email)}, ${passwordHash}, ${"owner"}, TRUE)
    ON CONFLICT (email)
    DO UPDATE SET password_hash = EXCLUDED.password_hash, is_active = TRUE, updated_at = NOW()
    RETURNING id, email, role
  `;
  return { id: Number(user.id), email: String(user.email), role: String(user.role) as NataliaAdminUser["role"] };
}

export async function createNataliaAdminSession(email: string, password: string) {
  const sql = getSql();
  const [user] = await sql`
    SELECT id, email, password_hash AS "passwordHash", role
    FROM pilot_admin_users
    WHERE email = ${normalizeEmail(email)} AND is_active = TRUE
    LIMIT 1
  `;
  if (!user || !(await verifyPortalPassword(password, String(user.passwordHash)))) return null;

  const token = randomBytes(32).toString("base64url");
  const expiresAt = new Date(Date.now() + SESSION_TTL_SECONDS * 1000);
  await sql`
    INSERT INTO pilot_admin_sessions (user_id, token_hash, expires_at)
    VALUES (${Number(user.id)}, ${tokenHash(token)}, ${expiresAt.toISOString()})
  `;
  return { token, expiresAt, user: { id: Number(user.id), email: String(user.email), role: String(user.role) as NataliaAdminUser["role"] } };
}

export async function getNataliaAdminSession(token: string | undefined) {
  if (!token) return null;
  const sql = getSql();
  const [session] = await sql`
    SELECT u.id, u.email, u.role
    FROM pilot_admin_sessions s
    JOIN pilot_admin_users u ON u.id = s.user_id
    WHERE s.token_hash = ${tokenHash(token)} AND s.expires_at > NOW() AND u.is_active = TRUE
    LIMIT 1
  `;
  if (!session) return null;
  return { id: Number(session.id), email: String(session.email), role: String(session.role) as NataliaAdminUser["role"] };
}

export async function revokeNataliaAdminSession(token: string | undefined) {
  if (!token) return;
  const sql = getSql();
  await sql`DELETE FROM pilot_admin_sessions WHERE token_hash = ${tokenHash(token)}`;
}

export function parsePortalCookie(cookieHeader: string | undefined) {
  const cookie = cookieHeader?.split(";").map((entry) => entry.trim()).find((entry) => entry.startsWith("natalia_admin_session="));
  return cookie ? decodeURIComponent(cookie.split("=").slice(1).join("=")) : undefined;
}

export function portalSessionCookie(token: string, maxAgeSeconds = SESSION_TTL_SECONDS) {
  return `natalia_admin_session=${encodeURIComponent(token)}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${maxAgeSeconds}`;
}

export type AdminServiceInput = {
  id?: number;
  slug?: string;
  name: string;
  description: string;
  priceNote: string;
  durationNote: string;
  enabled: boolean;
  paymentMode?: ServicePaymentMode;
  paymentAmountClp?: number | null;
  paymentPercentage?: number | null;
  status?: ServiceStatus;
  sortOrder?: number;
  preparationInstructions?: string;
  postcareInstructions?: string;
};

export type AvailabilityInput = {
  startsAt: string;
  endsAt: string;
  note?: string;
};

export type CourseInput = {
  id?: number;
  slug?: string;
  title: string;
  description: string;
  priceNote: string;
  durationNote: string;
  enabled: boolean;
  status?: CourseStatus;
  sortOrder?: number;
  instructions?: string;
  materials?: Array<{ label: string; url: string }>;
  capacity?: number | null;
  paymentMode?: ServicePaymentMode;
  paymentAmountClp?: number | null;
};

export function validateNataliaAvailability(input: AvailabilityInput) {
  const startsAt = new Date(input.startsAt);
  const endsAt = new Date(input.endsAt);
  if (Number.isNaN(startsAt.getTime()) || Number.isNaN(endsAt.getTime()) || endsAt <= startsAt) {
    throw new Error("El horario seleccionado no es válido.");
  }
  return { startsAt: startsAt.toISOString(), endsAt: endsAt.toISOString(), note: input.note?.trim() || null };
}

function requireText(value: string, label: string, maxLength: number) {
  const normalized = value.trim();
  if (!normalized || normalized.length > maxLength) throw new Error(`${label} no es válido.`);
  return normalized;
}

function createSlug(value: string) {
  const normalized = value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
  return normalized.slice(0, 70) || "servicio";
}

function optionalPositiveInteger(value: number | null | undefined, label: string) {
  if (value === null || value === undefined || value === 0) return null;
  if (!Number.isInteger(value) || value < 1) throw new Error(`${label} no es válido.`);
  return value;
}

function optionalPercentage(value: number | null | undefined) {
  if (value === null || value === undefined || value === 0) return null;
  if (!Number.isFinite(value) || value <= 0 || value > 100) throw new Error("El porcentaje de seña no es válido.");
  return Number(value.toFixed(2));
}

function serviceResponseFields() {
  return "id, slug, name, description, price_note AS \"priceNote\", duration_note AS \"durationNote\", enabled, payment_mode AS \"paymentMode\", payment_amount_clp AS \"paymentAmountClp\", payment_percentage AS \"paymentPercentage\", status, sort_order AS \"sortOrder\", preparation_instructions AS \"preparationInstructions\", postcare_instructions AS \"postcareInstructions\", archived_at AS \"archivedAt\"";
}

export async function listNataliaAdminServices() {
  const sql = getSql();
  return sql`SELECT id, slug, name, description, price_note AS "priceNote", duration_note AS "durationNote", enabled,
    payment_mode AS "paymentMode", payment_amount_clp AS "paymentAmountClp", payment_percentage AS "paymentPercentage",
    status, sort_order AS "sortOrder", preparation_instructions AS "preparationInstructions",
    postcare_instructions AS "postcareInstructions", archived_at AS "archivedAt"
    FROM pilot_services ORDER BY sort_order ASC, id ASC`;
}

export async function updateNataliaService(input: AdminServiceInput) {
  return saveNataliaService({ ...input, id: input.id, slug: input.slug });
}

export async function saveNataliaService(input: AdminServiceInput) {
  const sql = getSql();
  const name = requireText(input.name, "El nombre", 120);
  const description = requireText(input.description, "La descripción", 1_200);
  const priceNote = requireText(input.priceNote, "El precio", 180);
  const durationNote = requireText(input.durationNote, "La duración", 180);
  const paymentMode = assertOneOf(input.paymentMode ?? "none", servicePaymentModes, "La modalidad de cobro");
  const paymentAmountClp = optionalPositiveInteger(input.paymentAmountClp, "El monto de cobro");
  const paymentPercentage = optionalPercentage(input.paymentPercentage);
  if (paymentMode === "deposit" && !paymentAmountClp && !paymentPercentage) throw new Error("Configura un monto o porcentaje para la seña.");
  if (paymentMode !== "deposit" && (paymentAmountClp || paymentPercentage)) throw new Error("El monto o porcentaje sólo se usa con seña.");
  const status = assertOneOf(input.status ?? (input.enabled ? "active" : "paused"), serviceStatuses, "El estado");
  const enabled = status === "active" && input.enabled;
  const sortOrder = Number.isInteger(input.sortOrder) ? Math.max(0, Number(input.sortOrder)) : 0;
  const preparationInstructions = (input.preparationInstructions ?? "").trim().slice(0, 2_000);
  const postcareInstructions = (input.postcareInstructions ?? "").trim().slice(0, 2_000);

  if (input.id) {
    const [service] = await sql`
      UPDATE pilot_services SET name = ${name}, description = ${description}, price_note = ${priceNote}, duration_note = ${durationNote}, enabled = ${enabled},
        payment_mode = ${paymentMode}, payment_amount_clp = ${paymentAmountClp}, payment_percentage = ${paymentPercentage}, status = ${status},
        sort_order = ${sortOrder}, preparation_instructions = ${preparationInstructions}, postcare_instructions = ${postcareInstructions},
        archived_at = ${status === "archived" ? new Date().toISOString() : null}, updated_at = NOW()
      WHERE id = ${input.id}
      RETURNING id, slug, name, description, price_note AS "priceNote", duration_note AS "durationNote", enabled,
        payment_mode AS "paymentMode", payment_amount_clp AS "paymentAmountClp", payment_percentage AS "paymentPercentage", status,
        sort_order AS "sortOrder", preparation_instructions AS "preparationInstructions", postcare_instructions AS "postcareInstructions", archived_at AS "archivedAt"
    `;
    if (!service) throw new Error("El servicio no existe.");
    return service;
  }

  const baseSlug = createSlug(input.slug || name);
  const [service] = await sql`
    INSERT INTO pilot_services (slug, name, description, price_note, duration_note, enabled, payment_mode, payment_amount_clp, payment_percentage, status, sort_order, preparation_instructions, postcare_instructions)
    VALUES (${`${baseSlug}-${Date.now().toString(36)}`}, ${name}, ${description}, ${priceNote}, ${durationNote}, ${enabled}, ${paymentMode}, ${paymentAmountClp}, ${paymentPercentage}, ${status}, ${sortOrder}, ${preparationInstructions}, ${postcareInstructions})
    RETURNING id, slug, name, description, price_note AS "priceNote", duration_note AS "durationNote", enabled,
      payment_mode AS "paymentMode", payment_amount_clp AS "paymentAmountClp", payment_percentage AS "paymentPercentage", status,
      sort_order AS "sortOrder", preparation_instructions AS "preparationInstructions", postcare_instructions AS "postcareInstructions", archived_at AS "archivedAt"
  `;
  return service;
}

export async function listNataliaAvailability() {
  const sql = getSql();
  return sql`
    SELECT id, starts_at AS "startsAt", ends_at AS "endsAt", status, note, hold_expires_at AS "holdExpiresAt"
    FROM pilot_availability_slots
    WHERE starts_at >= NOW() - INTERVAL '1 day'
    ORDER BY starts_at ASC
    LIMIT 80
  `;
}

export async function createNataliaAvailability(input: AvailabilityInput) {
  const validated = validateNataliaAvailability(input);
  const sql = getSql();
  const [slot] = await sql`
    INSERT INTO pilot_availability_slots (starts_at, ends_at, status, note)
    VALUES (${validated.startsAt}, ${validated.endsAt}, ${"available"}, ${validated.note})
    RETURNING id, starts_at AS "startsAt", ends_at AS "endsAt", status, note
  `;
  return slot;
}

export async function listNataliaWeeklySchedule() {
  const sql = getSql();
  return sql`
    SELECT id, weekday, starts_minute AS "startsMinute", ends_minute AS "endsMinute", slot_duration_minutes AS "slotDurationMinutes",
      buffer_minutes AS "bufferMinutes", is_enabled AS "isEnabled"
    FROM pilot_weekly_schedule_rules
    ORDER BY weekday ASC, starts_minute ASC
  `;
}

export async function createNataliaWeeklyScheduleRule(input: WeeklyScheduleRuleInput) {
  const rule = validateWeeklyScheduleRule(input);
  const sql = getSql();
  const [created] = await sql`
    INSERT INTO pilot_weekly_schedule_rules (weekday, starts_minute, ends_minute, slot_duration_minutes, buffer_minutes, is_enabled)
    VALUES (${rule.weekday}, ${rule.startsMinute}, ${rule.endsMinute}, ${rule.slotDurationMinutes}, ${rule.bufferMinutes}, ${rule.isEnabled})
    RETURNING id, weekday, starts_minute AS "startsMinute", ends_minute AS "endsMinute", slot_duration_minutes AS "slotDurationMinutes", buffer_minutes AS "bufferMinutes", is_enabled AS "isEnabled"
  `;
  return created;
}

export async function deleteNataliaWeeklyScheduleRule(id: number) {
  if (!Number.isInteger(id) || id < 1) throw new Error("La regla de agenda no es válida.");
  const sql = getSql();
  const [removed] = await sql`DELETE FROM pilot_weekly_schedule_rules WHERE id = ${id} RETURNING id`;
  if (!removed) throw new Error("La regla de agenda no existe.");
  return { id: Number(removed.id) };
}

export async function listNataliaScheduleExceptions() {
  const sql = getSql();
  return sql`
    SELECT id, starts_at AS "startsAt", ends_at AS "endsAt", kind, note
    FROM pilot_schedule_exceptions
    WHERE ends_at >= NOW() - INTERVAL '1 day'
    ORDER BY starts_at ASC
  `;
}

export async function createNataliaScheduleException(input: { startsAt: string; endsAt: string; kind: "blocked" | "special_opening"; note?: string }) {
  const startsAt = new Date(input.startsAt);
  const endsAt = new Date(input.endsAt);
  if (Number.isNaN(startsAt.getTime()) || Number.isNaN(endsAt.getTime()) || endsAt <= startsAt) throw new Error("La excepción de agenda no es válida.");
  if (input.kind !== "blocked" && input.kind !== "special_opening") throw new Error("El tipo de excepción no es válido.");
  const sql = getSql();
  const [exception] = await sql`
    INSERT INTO pilot_schedule_exceptions (starts_at, ends_at, kind, note)
    VALUES (${startsAt.toISOString()}, ${endsAt.toISOString()}, ${input.kind}, ${input.note?.trim().slice(0, 500) || null})
    RETURNING id, starts_at AS "startsAt", ends_at AS "endsAt", kind, note
  `;
  return exception;
}

export async function deleteNataliaScheduleException(id: number) {
  if (!Number.isInteger(id) || id < 1) throw new Error("La excepción no es válida.");
  const sql = getSql();
  const [removed] = await sql`DELETE FROM pilot_schedule_exceptions WHERE id = ${id} RETURNING id`;
  if (!removed) throw new Error("La excepción no existe.");
  return { id: Number(removed.id) };
}

export async function listNataliaCourses() {
  const sql = getSql();
  return sql`
    SELECT id, slug, title, description, price_note AS "priceNote", duration_note AS "durationNote", enabled, status,
      sort_order AS "sortOrder", instructions, materials, capacity, payment_mode AS "paymentMode", payment_amount_clp AS "paymentAmountClp", archived_at AS "archivedAt"
    FROM pilot_courses
    ORDER BY sort_order ASC, id ASC
  `;
}

export async function createNataliaCourse(input: CourseInput) {
  return saveNataliaCourse(input);
}

function normalizeMaterials(materials: CourseInput["materials"]) {
  if (!materials) return [];
  if (!Array.isArray(materials) || materials.length > 30) throw new Error("Los materiales no son válidos.");
  return materials.map((item) => ({
    label: requireText(String(item.label ?? ""), "El nombre del material", 120),
    url: requireText(String(item.url ?? ""), "El enlace del material", 1_000),
  }));
}

export async function saveNataliaCourse(input: CourseInput) {
  const sql = getSql();
  const title = requireText(input.title, "El título", 180);
  const description = input.description.trim().slice(0, 1_200);
  const priceNote = requireText(input.priceNote, "El precio", 180);
  const durationNote = input.durationNote.trim().slice(0, 180);
  const status = assertOneOf(input.status ?? (input.enabled ? "coming_soon" : "draft"), courseStatuses, "El estado del curso");
  const materials = normalizeMaterials(input.materials);
  const capacity = optionalPositiveInteger(input.capacity, "El cupo del curso");
  const paymentMode = assertOneOf(input.paymentMode ?? "full_payment", servicePaymentModes, "La modalidad de cobro");
  const paymentAmountClp = optionalPositiveInteger(input.paymentAmountClp, "El precio del curso");
  const enabled = ["coming_soon", "open"].includes(status) && input.enabled;
  const sortOrder = Number.isInteger(input.sortOrder) ? Math.max(0, Number(input.sortOrder)) : 0;
  const instructions = (input.instructions ?? "").trim().slice(0, 2_000);

  if (input.id) {
    const [course] = await sql`
      UPDATE pilot_courses
      SET title = ${title}, description = ${description}, price_note = ${priceNote}, duration_note = ${durationNote}, enabled = ${enabled},
        status = ${status}, sort_order = ${sortOrder}, instructions = ${instructions}, materials = ${JSON.stringify(materials)}::jsonb,
        capacity = ${capacity}, payment_mode = ${paymentMode}, payment_amount_clp = ${paymentAmountClp},
        archived_at = ${status === "archived" ? new Date().toISOString() : null}, updated_at = NOW()
      WHERE id = ${input.id}
      RETURNING id, slug, title, description, price_note AS "priceNote", duration_note AS "durationNote", enabled, status,
        sort_order AS "sortOrder", instructions, materials, capacity, payment_mode AS "paymentMode", payment_amount_clp AS "paymentAmountClp", archived_at AS "archivedAt"
    `;
    if (!course) throw new Error("El curso no existe.");
    return course;
  }

  const [course] = await sql`
    INSERT INTO pilot_courses (slug, title, description, price_note, duration_note, enabled, status, sort_order, instructions, materials, capacity, payment_mode, payment_amount_clp)
    VALUES (${`${createSlug(input.slug || title)}-${Date.now().toString(36)}`}, ${title}, ${description}, ${priceNote}, ${durationNote}, ${enabled}, ${status}, ${sortOrder}, ${instructions}, ${JSON.stringify(materials)}::jsonb, ${capacity}, ${paymentMode}, ${paymentAmountClp})
    RETURNING id, slug, title, description, price_note AS "priceNote", duration_note AS "durationNote", enabled, status,
      sort_order AS "sortOrder", instructions, materials, capacity, payment_mode AS "paymentMode", payment_amount_clp AS "paymentAmountClp", archived_at AS "archivedAt"
  `;
  return course;
}

export async function listNataliaSiteContent() {
  const sql = getSql();
  return sql`
    SELECT content_key AS "contentKey", content_value AS "contentValue", draft_value AS "draftValue",
      publication_status AS "publicationStatus", published_at AS "publishedAt", updated_at AS "updatedAt"
    FROM pilot_site_content
    ORDER BY content_key ASC
  `;
}

export async function saveNataliaSiteContent(input: { contentKey: string; contentValue: unknown; adminId: number; publish: boolean }) {
  const contentKey = requireText(input.contentKey, "La clave de contenido", 100);
  const serialized = JSON.stringify(input.contentValue);
  if (serialized.length > 20_000) throw new Error("El contenido es demasiado extenso.");
  const sql = getSql();
  const [saved] = await sql`
    INSERT INTO pilot_site_content (content_key, content_value, draft_value, publication_status, published_at, updated_by_admin_id, updated_at)
    VALUES (${contentKey}, ${input.publish ? serialized : "{}"}::jsonb, ${serialized}::jsonb, ${input.publish ? "published" : "draft"}, ${input.publish ? new Date().toISOString() : null}, ${input.adminId}, NOW())
    ON CONFLICT (content_key)
    DO UPDATE SET
      content_value = CASE WHEN ${input.publish} THEN EXCLUDED.draft_value ELSE pilot_site_content.content_value END,
      draft_value = EXCLUDED.draft_value,
      publication_status = EXCLUDED.publication_status,
      published_at = CASE WHEN ${input.publish} THEN NOW() ELSE pilot_site_content.published_at END,
      updated_by_admin_id = EXCLUDED.updated_by_admin_id,
      updated_at = NOW()
    RETURNING content_key AS "contentKey", content_value AS "contentValue", draft_value AS "draftValue", publication_status AS "publicationStatus", published_at AS "publishedAt"
  `;
  await sql`
    INSERT INTO pilot_site_content_versions (content_key, content_value, status, created_by_admin_id)
    VALUES (${contentKey}, ${serialized}::jsonb, ${input.publish ? "published" : "draft"}, ${input.adminId})
  `;
  return saved;
}

export async function updateNataliaBookingStatus(input: { bookingId: number; status: BookingStatus; adminId: number; note?: string }) {
  if (!Number.isInteger(input.bookingId) || input.bookingId < 1) throw new Error("La reserva no es válida.");
  const status = assertOneOf(input.status, bookingStatuses, "El estado de reserva");
  const sql = getSql();
  const [booking] = await sql`SELECT id, status FROM pilot_booking_requests WHERE id = ${input.bookingId} LIMIT 1`;
  if (!booking) throw new Error("La reserva no existe.");
  const attendanceStatus = status === "attended" ? "attended" : status === "no_show" ? "no_show" : status === "cancelled" ? "cancelled" : "upcoming";
  const [updated] = await sql`
    UPDATE pilot_booking_requests
    SET status = ${status}, attendance_status = ${attendanceStatus}, status_reason = ${input.note?.trim().slice(0, 1_000) || null}
    WHERE id = ${input.bookingId}
    RETURNING id, status, attendance_status AS "attendanceStatus", status_reason AS "statusReason"
  `;
  await sql`
    INSERT INTO pilot_booking_audit (booking_id, actor_admin_id, event_type, previous_status, next_status, note)
    VALUES (${input.bookingId}, ${input.adminId}, ${"booking.status_changed"}, ${String(booking.status)}, ${status}, ${input.note?.trim().slice(0, 1_000) || null})
  `;
  return updated;
}
