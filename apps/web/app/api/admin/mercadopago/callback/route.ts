import { readCookie, clearCookie } from "@naty/api/auth/cookies";
import { requireAdminUser } from "@naty/api/context";
import { ENV } from "@naty/api/env";
import { completeMpConnection } from "@naty/api/services/mercadopago-connection";

// El driver `pg` necesita un socket TCP real, que no existe en el runtime Edge.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const STATE_COOKIE = "mp_oauth_state";

function redirectToAjustes(status: "connected" | "error"): Response {
  const headers = new Headers({ Location: `${ENV.siteUrl}/admin/ajustes?mp=${status}` });
  clearCookie(headers, STATE_COOKIE, { path: "/" });
  return new Response(null, { status: 302, headers });
}

/** Mercado Pago vuelve acá con el `code` tras la autorización de Naty. */
export async function GET(req: Request): Promise<Response> {
  const admin = await requireAdminUser(req);
  if (!admin) {
    return Response.json({ error: "No autorizado" }, { status: 401 });
  }

  const url = new URL(req.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const cookieState = readCookie(req, STATE_COOKIE);

  if (!code || !state || !cookieState || state !== cookieState) {
    return redirectToAjustes("error");
  }

  try {
    await completeMpConnection(code, `${ENV.siteUrl}/api/admin/mercadopago/callback`);
    return redirectToAjustes("connected");
  } catch (error) {
    console.error("[mercadopago callback] no se pudo completar la conexión:", error);
    return redirectToAjustes("error");
  }
}
