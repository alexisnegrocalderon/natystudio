import { migrate } from "drizzle-orm/node-postgres/migrator";
import { sql } from "drizzle-orm";
import { db, pool } from "./index";

/**
 * Sentencias que Drizzle no puede generar desde el esquema TypeScript.
 * Se ejecutan después de las migraciones y son idempotentes, así que correr
 * `pnpm db:migrate` dos veces no rompe nada.
 */
async function applyPostMigrationSql() {
  // `btree_gist` permite combinar el operador de rangos (&&) con columnas
  // escalares dentro de un mismo índice GiST. Es lo que habilita el constraint
  // de exclusión de más abajo.
  await db.execute(sql`CREATE EXTENSION IF NOT EXISTS btree_gist`);

  /**
   * Aquí está la garantía central de la agenda: PostgreSQL rechaza cualquier
   * cita cuyo rango [inicio, fin_del_bloqueo) se cruce con el de otra que siga
   * ocupando la hora. Dos personas reservando el mismo horario al mismo tiempo
   * ya no dependen de que el código bloquee bien: la segunda inserción falla.
   *
   * El rango llega hasta `blocked_until` (fin + buffer del servicio) para que
   * el tiempo de limpieza también quede protegido.
   */
  const constraintExists = await db.execute(sql`
    SELECT 1 FROM pg_constraint WHERE conname = 'appointments_no_overlap'
  `);

  if (constraintExists.rows.length === 0) {
    await db.execute(sql`
      ALTER TABLE appointments
      ADD CONSTRAINT appointments_no_overlap
      EXCLUDE USING gist (tstzrange(starts_at, blocked_until) WITH &&)
      WHERE (status IN ('pending_payment', 'pending_approval', 'confirmed'))
    `);
    console.log("[migrate] constraint appointments_no_overlap creado");
  }

  // Fila única de configuración de la agenda.
  await db.execute(sql`
    INSERT INTO scheduling_settings (id) VALUES (1) ON CONFLICT (id) DO NOTHING
  `);
}

async function main() {
  console.log("[migrate] aplicando migraciones…");
  await migrate(db, { migrationsFolder: "./drizzle" });
  await applyPostMigrationSql();
  console.log("[migrate] listo");
}

main()
  .catch(error => {
    console.error("[migrate] falló:", error);
    process.exitCode = 1;
  })
  .finally(() => pool.end());
