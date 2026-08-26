import type { FetchCreateContextFnOptions } from "@trpc/server/adapters/fetch";
import { parse as parseCookies } from "cookie";
import { eq } from "drizzle-orm";
import { ADMIN_SESSION_COOKIE } from "@naty/shared";
import { verifySessionToken } from "./auth/session";
import { db, users, type User } from "./db";

export type TrpcContext = {
  req: Request;
  /** Cabeceras de la respuesta que el adaptador fetch de tRPC fusiona al final. */
  resHeaders: Headers;
  user: User | null;
};

export async function createContext(opts: FetchCreateContextFnOptions): Promise<TrpcContext> {
  const user = await userFromRequest(opts.req);
  return { req: opts.req, resHeaders: opts.resHeaders, user };
}

async function userFromRequest(req: Request): Promise<User | null> {
  const token = parseCookies(req.headers.get("cookie") ?? "")[ADMIN_SESSION_COOKIE];
  const userId = verifySessionToken(token);
  if (userId === null) return null;

  const found = await db.select().from(users).where(eq(users.id, userId)).limit(1);
  return found[0] ?? null;
}

/**
 * Para rutas que no pasan por tRPC (descargas de archivos: tRPC no maneja
 * binarios cómodamente) pero necesitan la misma protección que `adminProcedure`.
 * Nulo si no hay sesión válida o la cuenta no es de administración.
 */
export async function requireAdminUser(req: Request): Promise<User | null> {
  const user = await userFromRequest(req);
  return user && user.role === "admin" ? user : null;
}
