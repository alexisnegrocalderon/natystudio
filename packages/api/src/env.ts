import "dotenv/config";

const isProduction = process.env.NODE_ENV === "production";

function required(name: string, fallback?: string): string {
  const value = process.env[name]?.trim();
  if (value) return value;
  if (fallback !== undefined && !isProduction) return fallback;
  throw new Error(
    `Falta la variable de entorno ${name}. Revisa apps/api/.env.example para saber qué valor espera.`,
  );
}

function optional(name: string, fallback = ""): string {
  return process.env[name]?.trim() || fallback;
}

function boolean(name: string, fallback: boolean): boolean {
  const value = process.env[name]?.trim().toLowerCase();
  if (!value) return fallback;
  return value === "true" || value === "1" || value === "yes";
}

export const ENV = {
  isProduction,
  databaseUrl: required("DATABASE_URL"),
  /** URL pública del sitio, usada para armar enlaces dentro de los correos. */
  siteUrl: optional("SITE_URL", "http://localhost:3000").replace(/\/$/, ""),

  /** Firma las cookies de sesión del panel. En producción es obligatoria. */
  adminSessionSecret: required("ADMIN_SESSION_SECRET", "desarrollo-inseguro-cambiar"),

  resendApiKey: optional("RESEND_API_KEY"),
  mailFrom: optional("MAIL_FROM", "naty.studio <onboarding@resend.dev>"),
  /** Casilla donde Naty recibe el aviso de cada reserva nueva. */
  adminNotifyEmail: optional("ADMIN_NOTIFY_EMAIL"),

  /** Secreto compartido con Next.js para revalidar páginas estáticas al editar contenido. */
  revalidateSecret: optional("REVALIDATE_SECRET"),

  /**
   * Protege /api/cron: sin este valor coincidiendo, cualquiera podría forzar
   * el reenvío de recordatorios repetidamente. Obligatorio en producción.
   */
  cronSecret: required("CRON_SECRET", "desarrollo-inseguro-cambiar"),

  /** Los pagos siguen apagados hasta que existan credenciales de Mercado Pago. */
  paymentsEnabled: boolean("PAYMENTS_ENABLED", false),
  mercadoPago: {
    accessToken: optional("MP_ACCESS_TOKEN"),
    publicKey: optional("MP_PUBLIC_KEY"),
    webhookSecret: optional("MP_WEBHOOK_SECRET"),
    /** Aplicación de Mercado Pago (marketplace) para conectar la cuenta de Naty vía OAuth. */
    clientId: optional("MP_CLIENT_ID"),
    clientSecret: optional("MP_CLIENT_SECRET"),
  },

  /** Redacción con IA (mailing y descripciones de servicios). Vacío = los botones de IA quedan apagados. */
  geminiApiKey: optional("GEMINI_API_KEY"),
  geminiModel: optional("GEMINI_MODEL", "gemini-3.6-flash"),

  /** Subida de fotos de servicios. Vacío = el form no ofrece cargar imagen. */
  blobReadWriteToken: optional("BLOB_READ_WRITE_TOKEN"),
} as const;

if (ENV.paymentsEnabled && !ENV.mercadoPago.accessToken) {
  throw new Error(
    "PAYMENTS_ENABLED está en true pero falta MP_ACCESS_TOKEN. Deja los pagos apagados hasta tener las credenciales.",
  );
}

if (ENV.paymentsEnabled && !ENV.mercadoPago.webhookSecret) {
  // No es un error duro: los pagos igual funcionan por la respuesta en línea
  // de payment.process. Pero sin el secreto el webhook no puede validar su
  // firma y queda inerte, así que un pago que sólo se resuelve por webhook
  // (in_process → approved más tarde) se perdería hasta que corra el cron.
  console.warn(
    "[env] PAYMENTS_ENABLED está en true sin MP_WEBHOOK_SECRET: el webhook de Mercado Pago no podrá validar su firma.",
  );
}

if (ENV.isProduction && ENV.adminSessionSecret === "desarrollo-inseguro-cambiar") {
  throw new Error("ADMIN_SESSION_SECRET no puede quedarse con el valor de desarrollo en producción.");
}
