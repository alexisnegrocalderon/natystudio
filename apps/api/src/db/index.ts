import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import { ENV } from "../env";
import * as schema from "./schema";

/**
 * Neon exige TLS. La cadena de conexión trae `sslmode=require`, pero lo dejamos
 * explícito para que un `DATABASE_URL` mal copiado falle al conectar y no
 * silenciosamente en claro. `rejectUnauthorized` queda activo porque Neon
 * presenta certificados válidos.
 */
const needsSsl = /sslmode=(require|verify-ca|verify-full)/.test(ENV.databaseUrl);

export const pool = new pg.Pool({
  connectionString: ENV.databaseUrl,
  ssl: needsSsl ? { rejectUnauthorized: true } : undefined,
  /**
   * El plan gratuito de Neon suspende la base tras unos minutos sin uso y la
   * primera consulta después de una pausa tarda algo más de lo normal. Un
   * timeout corto convertiría ese despertar en un error.
   */
  connectionTimeoutMillis: 15_000,
  idleTimeoutMillis: 30_000,
  max: 10,
});

pool.on("error", error => {
  console.error("[db] error inesperado en el pool de conexiones:", error);
});

export const db = drizzle(pool, { schema, casing: "snake_case" });

export type Db = typeof db;
export * from "./schema";
