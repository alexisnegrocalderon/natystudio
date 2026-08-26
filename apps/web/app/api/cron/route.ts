import { ENV } from "@naty/api/env";
import { runMaintenanceTick } from "@naty/api/scheduler";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Mantenimiento periódico: envía los correos vencidos de la cola y libera los
 * horarios que quedaron reservados sin pagar. Antes corría como un cron
 * interno (`node-cron`) del proceso permanente en Railway; en un entorno
 * serverless no hay proceso que mantener vivo, así que un servicio externo
 * (p. ej. cron-job.org) dispara esta ruta cada 5 minutos.
 *
 * Sin la clave correcta, cualquiera podría forzar el reenvío repetido de
 * recordatorios — por eso exige `CRON_SECRET` como query param o cabecera.
 */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const provided = url.searchParams.get("key") ?? req.headers.get("authorization")?.replace(/^Bearer\s+/i, "");

  if (provided !== ENV.cronSecret) {
    return Response.json({ error: "No autorizado" }, { status: 401 });
  }

  const { sent, released, reconciled } = await runMaintenanceTick();
  return Response.json({ ok: true, sent, released, reconciled });
}
