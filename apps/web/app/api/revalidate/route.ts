import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";

/**
 * Regenera páginas estáticas a petición del API, que llama aquí cuando Naty
 * edita un servicio o publica un artículo. Sin esto, un cambio de precio
 * tardaría hasta que venciera el ISR en aparecer en el sitio.
 */
export async function POST(request: Request) {
  const secret = process.env.REVALIDATE_SECRET;

  // Sin secreto configurado el endpoint queda cerrado: dejarlo abierto
  // permitiría a cualquiera forzar regeneraciones continuas.
  if (!secret) {
    return NextResponse.json({ error: "Revalidación no configurada" }, { status: 503 });
  }

  if (request.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  let paths: unknown;
  try {
    ({ paths } = await request.json());
  } catch {
    return NextResponse.json({ error: "Cuerpo inválido" }, { status: 400 });
  }

  if (!Array.isArray(paths) || paths.some(path => typeof path !== "string")) {
    return NextResponse.json({ error: "Se espera { paths: string[] }" }, { status: 400 });
  }

  // Sólo rutas internas: una URL absoluta aquí no tendría sentido y podría
  // usarse para sondear el comportamiento del servidor.
  const safePaths = (paths as string[]).filter(path => path.startsWith("/") && !path.startsWith("//"));
  for (const path of safePaths) {
    revalidatePath(path);
  }

  return NextResponse.json({ revalidated: safePaths });
}
