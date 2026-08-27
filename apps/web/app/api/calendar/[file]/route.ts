import { buildIcsForAppointment } from "@naty/api/services/calendar";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Archivo de calendario de una cita. Vive fuera de tRPC porque debe poder
 * descargarse con una petición GET normal desde el correo o el navegador.
 *
 * La ruta usa `[file]` (no `[publicId]`) porque el nombre de archivo real que
 * ven los clientes de correo es `<publicId>.ics` — se conserva esa URL tal
 * cual la usaban ya `BookingDetail.tsx` y los enlaces enviados por correo.
 */
export async function GET(_req: Request, { params }: { params: Promise<{ file: string }> }) {
  const { file } = await params;
  const publicId = file.replace(/\.ics$/i, "");

  const ics = await buildIcsForAppointment(publicId);
  if (!ics) {
    return Response.json({ error: "La reserva no existe." }, { status: 404 });
  }

  return new Response(ics, {
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      // "inline" (no "attachment"): en iOS/macOS Safari esto es lo que hace
      // que el .ics abra directo la pantalla nativa de "Agregar evento"
      // (con Cancelar/Agregar) en vez del diálogo genérico de "este sitio
      // quiere descargar un archivo".
      "Content-Disposition": 'inline; filename="cita-naty-studio.ics"',
    },
  });
}
