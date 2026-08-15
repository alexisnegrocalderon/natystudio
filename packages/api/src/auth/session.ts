import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { ENV } from "../env";

const SESSION_TTL_MS = 1000 * 60 * 60 * 12; // 12 horas

function sign(payload: string): string {
  return createHmac("sha256", ENV.adminSessionSecret).update(payload).digest("base64url");
}

/**
 * Compara firmas en tiempo constante. Un `===` normal corta en el primer byte
 * distinto, lo que filtra información sobre la firma correcta.
 */
function safeEqual(a: string, b: string): boolean {
  const bufferA = Buffer.from(a);
  const bufferB = Buffer.from(b);
  if (bufferA.length !== bufferB.length) return false;
  return timingSafeEqual(bufferA, bufferB);
}

export function createSessionToken(userId: number): string {
  const expiresAt = Date.now() + SESSION_TTL_MS;
  const payload = `${userId}.${expiresAt}`;
  return `${payload}.${sign(payload)}`;
}

export function verifySessionToken(token: string | undefined): number | null {
  if (!token) return null;

  const parts = token.split(".");
  if (parts.length !== 3) return null;

  const [rawUserId, rawExpiry, signature] = parts;
  if (!safeEqual(signature, sign(`${rawUserId}.${rawExpiry}`))) return null;

  const expiresAt = Number(rawExpiry);
  if (!Number.isFinite(expiresAt) || expiresAt < Date.now()) return null;

  const userId = Number(rawUserId);
  return Number.isInteger(userId) && userId > 0 ? userId : null;
}

export function generateToken(bytes = 24): string {
  return randomBytes(bytes).toString("base64url");
}

export const SESSION_MAX_AGE_MS = SESSION_TTL_MS;
