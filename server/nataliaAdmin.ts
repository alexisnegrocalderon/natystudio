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
