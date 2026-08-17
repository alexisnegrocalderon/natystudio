import { createHash, randomBytes, scrypt as scryptCallback, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";
import { neon } from "@neondatabase/serverless";

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
  slug: string;
  name: string;
  description: string;
  priceNote: string;
  durationNote: string;
  enabled: boolean;
};

export type AvailabilityInput = {
  startsAt: string;
  endsAt: string;
  note?: string;
};

export type CourseInput = {
  title: string;
  description: string;
  priceNote: string;
  durationNote: string;
  enabled: boolean;
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

export async function updateNataliaService(input: AdminServiceInput) {
  const sql = getSql();
  const slug = requireText(input.slug, "El servicio", 80);
  const [service] = await sql`
    UPDATE pilot_services
    SET name = ${requireText(input.name, "El nombre", 120)},
        description = ${requireText(input.description, "La descripción", 1_200)},
        price_note = ${requireText(input.priceNote, "El precio", 180)},
        duration_note = ${requireText(input.durationNote, "La duración", 180)},
        enabled = ${input.enabled},
        updated_at = NOW()
    WHERE slug = ${slug}
    RETURNING slug, name, description, price_note AS "priceNote", duration_note AS "durationNote", enabled
  `;
  if (!service) throw new Error("El servicio no existe.");
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

export async function listNataliaCourses() {
  const sql = getSql();
  return sql`
    SELECT id, title, description, price_note AS "priceNote", duration_note AS "durationNote", enabled
    FROM pilot_courses
    ORDER BY id ASC
  `;
}

export async function createNataliaCourse(input: CourseInput) {
  const sql = getSql();
  const [course] = await sql`
    INSERT INTO pilot_courses (title, description, price_note, duration_note, enabled)
    VALUES (
      ${requireText(input.title, "El título", 180)},
      ${input.description.trim().slice(0, 1_200)},
      ${requireText(input.priceNote, "El precio", 180)},
      ${input.durationNote.trim().slice(0, 180)},
      ${input.enabled}
    )
    RETURNING id, title, description, price_note AS "priceNote", duration_note AS "durationNote", enabled
  `;
  return course;
}
