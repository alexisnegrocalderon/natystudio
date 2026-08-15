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
  const token = parseCookies(opts.req.headers.get("cookie") ?? "")[ADMIN_SESSION_COOKIE];
  const userId = verifySessionToken(token);

  let user: User | null = null;
  if (userId !== null) {
    const found = await db.select().from(users).where(eq(users.id, userId)).limit(1);
    user = found[0] ?? null;
  }

  return { req: opts.req, resHeaders: opts.resHeaders, user };
}
