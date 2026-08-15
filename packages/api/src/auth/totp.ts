import { randomBytes } from "node:crypto";
import bcrypt from "bcryptjs";
import * as OTPAuth from "otpauth";

const ISSUER = "naty.studio";

export function createTotpSecret(): string {
  return new OTPAuth.Secret({ size: 20 }).base32;
}

export function buildTotp(secret: string, label: string): OTPAuth.TOTP {
  return new OTPAuth.TOTP({
    issuer: ISSUER,
    label,
    algorithm: "SHA1",
    digits: 6,
    period: 30,
    secret: OTPAuth.Secret.fromBase32(secret),
  });
}

/** URI `otpauth://` que se renderiza como QR para enrolar la app autenticadora. */
export function buildEnrollmentUri(secret: string, label: string): string {
  return buildTotp(secret, label).toString();
}

/**
 * Valida un código de 6 dígitos.
 *
 * La ventana de ±1 período tolera un reloj desincronizado hasta 30 segundos,
 * que es el desfase habitual entre un teléfono y el servidor. Ampliarla más
 * alargaría la vida útil de un código interceptado.
 */
export function verifyTotpCode(secret: string, code: string, label: string): boolean {
  const delta = buildTotp(secret, label).validate({ token: code.trim(), window: 1 });
  return delta !== null;
}

/** Genera códigos de respaldo legibles y sus hashes para guardar en la base. */
export async function generateBackupCodes(count = 8): Promise<{ plain: string[]; hashed: string[] }> {
  const plain = Array.from({ length: count }, () =>
    randomBytes(5).toString("hex").toUpperCase().match(/.{1,5}/g)!.join("-"),
  );
  const hashed = await Promise.all(plain.map(code => bcrypt.hash(code, 10)));
  return { plain, hashed };
}

/**
 * Busca un código de respaldo válido y devuelve la lista sin él: cada código
 * sirve una sola vez.
 */
export async function consumeBackupCode(
  code: string,
  hashedCodes: string[],
): Promise<{ matched: boolean; remaining: string[] }> {
  const normalized = code.trim().toUpperCase();

  for (const [index, hash] of hashedCodes.entries()) {
    if (await bcrypt.compare(normalized, hash)) {
      return { matched: true, remaining: hashedCodes.filter((_, i) => i !== index) };
    }
  }

  return { matched: false, remaining: hashedCodes };
}
