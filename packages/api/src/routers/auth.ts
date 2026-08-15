import { randomUUID } from "node:crypto";
import { TRPCError } from "@trpc/server";
import bcrypt from "bcryptjs";
import { and, eq, gt, lt } from "drizzle-orm";
import QRCode from "qrcode";
import { z } from "zod";
import { ADMIN_SESSION_COOKIE, adminLoginSchema, totpConfirmSchema, totpVerifySchema } from "@naty/shared";
import { createSessionToken, SESSION_MAX_AGE_MS } from "../auth/session";
import { clearCookie, setCookie } from "../auth/cookies";
import {
  buildEnrollmentUri,
  consumeBackupCode,
  createTotpSecret,
  generateBackupCodes,
  verifyTotpCode,
} from "../auth/totp";
import { db, totpChallenges, users } from "../db";
import { ENV } from "../env";
import { adminProcedure, publicProcedure, router } from "../trpc";

const MAX_FAILED_ATTEMPTS = 5;
const LOCK_DURATION_MS = 15 * 60_000;
const CHALLENGE_TTL_MS = 5 * 60_000;

/**
 * Mensaje único para credenciales inválidas. Distinguir "no existe la cuenta" de
 * "la contraseña es incorrecta" le confirmaría a un atacante qué correos están
 * registrados.
 */
const INVALID_CREDENTIALS = new TRPCError({
  code: "UNAUTHORIZED",
  message: "Correo o contraseña incorrectos.",
});

function setSessionCookie(resHeaders: Headers, userId: number) {
  setCookie(resHeaders, ADMIN_SESSION_COOKIE, createSessionToken(userId), {
    httpOnly: true,
    secure: ENV.isProduction,
    // Panel y API viven en el mismo origen (ambos dentro de apps/web), así que
    // "lax" alcanza — no hace falta "none", que exigiría relajar más la cookie.
    sameSite: "lax",
    maxAge: SESSION_MAX_AGE_MS / 1000,
    path: "/",
  });
}

export const authRouter = router({
  me: publicProcedure.query(({ ctx }) => {
    if (!ctx.user) return null;
    const { passwordHash: _p, totpSecret: _s, backupCodes: _b, ...safe } = ctx.user;
    return safe;
  }),

  login: publicProcedure.input(adminLoginSchema).mutation(async ({ ctx, input }) => {
    const rows = await db.select().from(users).where(eq(users.email, input.email)).limit(1);
    const user = rows[0];

    if (!user?.passwordHash) {
      // Se compara igualmente contra un hash ficticio para que responder a un
      // correo inexistente tarde lo mismo que a uno real.
      await bcrypt.compare(input.password, "$2a$10$invalidinvalidinvalidinvalidinvalidinvalidinvalidinv");
      throw INVALID_CREDENTIALS;
    }

    if (user.lockedUntil && user.lockedUntil > new Date()) {
      throw new TRPCError({
        code: "TOO_MANY_REQUESTS",
        message: "Demasiados intentos fallidos. Vuelve a intentarlo en unos minutos.",
      });
    }

    if (!(await bcrypt.compare(input.password, user.passwordHash))) {
      const attempts = user.failedLoginAttempts + 1;
      await db
        .update(users)
        .set({
          failedLoginAttempts: attempts,
          lockedUntil: attempts >= MAX_FAILED_ATTEMPTS ? new Date(Date.now() + LOCK_DURATION_MS) : null,
        })
        .where(eq(users.id, user.id));
      throw INVALID_CREDENTIALS;
    }

    await db
      .update(users)
      .set({ failedLoginAttempts: 0, lockedUntil: null })
      .where(eq(users.id, user.id));

    if (user.role !== "admin") {
      throw new TRPCError({ code: "FORBIDDEN", message: "Esta cuenta no administra el sitio." });
    }

    // Con el segundo factor activo la contraseña por sí sola no abre sesión:
    // sólo entrega un desafío de corta vida que hay que resolver con el código.
    if (user.totpEnabled && user.totpSecret) {
      const challengeId = randomUUID();
      await db.insert(totpChallenges).values({
        id: challengeId,
        userId: user.id,
        expiresAt: new Date(Date.now() + CHALLENGE_TTL_MS),
      });
      return { requiresTotp: true as const, challengeId };
    }

    setSessionCookie(ctx.resHeaders, user.id);
    await db.update(users).set({ lastSignedIn: new Date() }).where(eq(users.id, user.id));
    return { requiresTotp: false as const };
  }),

  verifyTotp: publicProcedure.input(totpVerifySchema).mutation(async ({ ctx, input }) => {
    // Limpieza oportunista de desafíos vencidos.
    await db.delete(totpChallenges).where(lt(totpChallenges.expiresAt, new Date()));

    const rows = await db
      .select({ challenge: totpChallenges, user: users })
      .from(totpChallenges)
      .innerJoin(users, eq(totpChallenges.userId, users.id))
      .where(and(eq(totpChallenges.id, input.challengeId), gt(totpChallenges.expiresAt, new Date())))
      .limit(1);

    const user = rows[0]?.user;
    const secret = user?.totpSecret;
    if (!user || !secret) {
      throw new TRPCError({
        code: "UNAUTHORIZED",
        message: "La verificación expiró. Inicia sesión de nuevo.",
      });
    }

    let valid = verifyTotpCode(secret, input.code, user.email);

    // Si no cuadra como código del autenticador, puede ser uno de respaldo.
    if (!valid && user.backupCodes?.length) {
      const result = await consumeBackupCode(input.code, user.backupCodes);
      if (result.matched) {
        valid = true;
        await db.update(users).set({ backupCodes: result.remaining }).where(eq(users.id, user.id));
      }
    }

    if (!valid) {
      throw new TRPCError({ code: "UNAUTHORIZED", message: "El código no es válido." });
    }

    // El desafío se consume: un código interceptado no sirve dos veces.
    await db.delete(totpChallenges).where(eq(totpChallenges.id, input.challengeId));

    setSessionCookie(ctx.resHeaders, user.id);
    await db.update(users).set({ lastSignedIn: new Date() }).where(eq(users.id, user.id));
    return { ok: true as const };
  }),

  logout: publicProcedure.mutation(({ ctx }) => {
    clearCookie(ctx.resHeaders, ADMIN_SESSION_COOKIE, { path: "/" });
    return { ok: true as const };
  }),

  /** Primer paso del enrolamiento: genera el secreto y el QR sin activarlo aún. */
  setupTotp: adminProcedure.mutation(async ({ ctx }) => {
    const secret = createTotpSecret();
    const uri = buildEnrollmentUri(secret, ctx.user.email);

    // Se guarda el secreto pero `totpEnabled` sigue en false: el segundo factor
    // no se activa hasta confirmar un código, para no dejar a Naty fuera del
    // panel si el enrolamiento se interrumpe a medias.
    await db.update(users).set({ totpSecret: secret }).where(eq(users.id, ctx.user.id));

    return { secret, uri, qrDataUrl: await QRCode.toDataURL(uri) };
  }),

  confirmTotp: adminProcedure.input(totpConfirmSchema).mutation(async ({ ctx, input }) => {
    if (!ctx.user.totpSecret) {
      throw new TRPCError({ code: "BAD_REQUEST", message: "Primero genera el código QR." });
    }

    if (!verifyTotpCode(ctx.user.totpSecret, input.code, ctx.user.email)) {
      throw new TRPCError({ code: "BAD_REQUEST", message: "El código no coincide. Inténtalo otra vez." });
    }

    const { plain, hashed } = await generateBackupCodes();
    await db
      .update(users)
      .set({ totpEnabled: true, backupCodes: hashed })
      .where(eq(users.id, ctx.user.id));

    // Los códigos en claro se devuelven una única vez: después sólo existen
    // hasheados y no hay forma de volver a mostrarlos.
    return { backupCodes: plain };
  }),

  disableTotp: adminProcedure.input(z.object({ password: z.string().min(1) })).mutation(async ({ ctx, input }) => {
    if (!ctx.user.passwordHash || !(await bcrypt.compare(input.password, ctx.user.passwordHash))) {
      throw INVALID_CREDENTIALS;
    }

    await db
      .update(users)
      .set({ totpEnabled: false, totpSecret: null, backupCodes: [] })
      .where(eq(users.id, ctx.user.id));

    return { ok: true as const };
  }),
});
