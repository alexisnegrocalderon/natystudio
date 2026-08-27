import { put } from "@vercel/blob";
import { requireAdminUser } from "@naty/api/context";

// El driver `pg` (para validar la sesión) necesita un socket TCP real, que no
// existe en el runtime Edge.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_BYTES = 5 * 1024 * 1024;
const ALLOWED_TYPES = new Set(["image/jpeg", "image/png", "image/webp", "image/avif"]);

/** Sube la foto de un servicio a Vercel Blob y devuelve su URL pública. */
export async function POST(req: Request) {
  const admin = await requireAdminUser(req);
  if (!admin) {
    return Response.json({ error: "No autorizado" }, { status: 401 });
  }

  if (!process.env.BLOB_READ_WRITE_TOKEN) {
    return Response.json(
      { error: "La subida de fotos no está configurada todavía (falta BLOB_READ_WRITE_TOKEN)." },
      { status: 503 },
    );
  }

  const form = await req.formData();
  const file = form.get("file");
  if (!(file instanceof File)) {
    return Response.json({ error: "No se recibió ningún archivo." }, { status: 400 });
  }
  if (!ALLOWED_TYPES.has(file.type)) {
    return Response.json({ error: "Formato no admitido. Usa JPG, PNG, WEBP o AVIF." }, { status: 400 });
  }
  if (file.size > MAX_BYTES) {
    return Response.json({ error: "La imagen pesa demasiado (máximo 5 MB)." }, { status: 400 });
  }

  const extension = file.type.split("/")[1] ?? "jpg";
  const blob = await put(`servicios/${Date.now()}-${crypto.randomUUID()}.${extension}`, file, {
    access: "public",
    contentType: file.type,
  });

  return Response.json({ url: blob.url });
}
