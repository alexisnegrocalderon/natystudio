import { randomBytes } from "node:crypto";
import bcrypt from "bcryptjs";
import { eq } from "drizzle-orm";
import { db, businessHours, pool, schedulingSettings, services, users } from "./index";

/**
 * Deja la base lista para trabajar: cuenta de administración, horario comercial
 * de ejemplo y el servicio que Naty ya ofrece. Es idempotente, así que se puede
 * volver a ejecutar sin duplicar nada.
 */
async function seed() {
  const email = process.env.ADMIN_EMAIL?.trim().toLowerCase();
  if (!email) {
    throw new Error("Define ADMIN_EMAIL antes de sembrar (es la cuenta con la que entrará Naty).");
  }

  // La contraseña se genera si no se entrega, y se muestra una sola vez.
  const password = process.env.ADMIN_PASSWORD?.trim() || randomBytes(9).toString("base64url");
  const passwordHash = await bcrypt.hash(password, 12);

  const existing = await db.select().from(users).where(eq(users.email, email)).limit(1);

  if (existing[0]) {
    await db
      .update(users)
      .set({ role: "admin", passwordHash, updatedAt: new Date() })
      .where(eq(users.id, existing[0].id));
    console.log(`✓ Contraseña actualizada para ${email}`);
  } else {
    await db.insert(users).values({ email, name: "Naty", role: "admin", passwordHash });
    console.log(`✓ Cuenta de administración creada para ${email}`);
  }

  console.log(`\n  Contraseña: ${password}\n  Guárdala ahora: no vuelve a mostrarse.\n`);

  await db
    .insert(schedulingSettings)
    .values({ id: 1, slotGranularityMin: 30, minLeadTimeHours: 12, maxAdvanceDays: 60 })
    .onConflictDoNothing();

  const hours = await db.select().from(businessHours).limit(1);
  if (!hours[0]) {
    // Lunes a viernes de 10:00 a 19:00 como punto de partida editable.
    await db.insert(businessHours).values(
      [1, 2, 3, 4, 5].map(weekday => ({
        weekday,
        startMinute: 10 * 60,
        endMinute: 19 * 60,
      })),
    );
    console.log("✓ Horario comercial inicial: lunes a viernes, 10:00–19:00");
  }

  const existingService = await db
    .select()
    .from(services)
    .where(eq(services.slug, "retiro-de-acrocordones"))
    .limit(1);

  if (!existingService[0]) {
    await db.insert(services).values({
      slug: "retiro-de-acrocordones",
      name: "Retiro de acrocordones",
      shortDescription:
        "Evaluación y retiro seguro de acrocordones, con indicaciones personalizadas para tu proceso.",
      longDescription:
        "Atención presencial en Valparaíso centrada en la evaluación previa, la técnica adecuada para cada caso y las indicaciones de cuidado posterior. La primera conversación permite orientar el procedimiento más apropiado para tu piel.",
      durationMin: 45,
      bufferMin: 15,
      // Precio y abono quedan en cero hasta que Naty confirme los valores reales.
      priceClp: 0,
      depositClp: 0,
      sortOrder: 0,
      metaTitle: "Retiro de acrocordones en Valparaíso",
      metaDescription:
        "Retiro de acrocordones con enfermera estética en Valparaíso. Evaluación previa, técnica segura e indicaciones de cuidado posterior.",
    });
    console.log("✓ Servicio inicial creado (precio en 0, pendiente de confirmar)");
  }

  console.log("\nListo.");
}

seed()
  .catch(error => {
    console.error("La siembra falló:", error);
    process.exitCode = 1;
  })
  .finally(() => pool.end());
