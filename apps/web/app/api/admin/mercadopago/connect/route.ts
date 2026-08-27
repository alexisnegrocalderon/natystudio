import { randomUUID } from "node:crypto";
import { requireAdminUser } from "@naty/api/context";
import { ENV } from "@naty/api/env";
import { setCookie } from "@naty/api/auth/cookies";
import { buildMpAuthorizationUrl } from "@naty/api/services/mercadopago";

// El driver `pg` (para validar la sesión) necesita un socket TCP real, que no
// existe en el runtime Edge.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const STATE_COOKIE = "mp_oauth_state";

/** Manda a Naty a autorizar la conexión de su cuenta de Mercado Pago. */
export async function GET(req: Request): Promise<Response> {
  const admin = await requireAdminUser(req);
  if (!admin) {
    return Response.json({ error: "No autorizado" }, { status: 401 });
  }
  if (!ENV.mercadoPago.clientId || !ENV.mercadoPago.clientSecret) {
    return Response.json(
      { error: "La conexión con Mercado Pago no está configurada todavía (falta MP_CLIENT_ID/MP_CLIENT_SECRET)." },
      { status: 503 },
    );
  }

  const state = randomUUID();
  const redirectUri = `${ENV.siteUrl}/api/admin/mercadopago/callback`;
  const headers = new Headers({ Location: buildMpAuthorizationUrl(redirectUri, state) });
  setCookie(headers, STATE_COOKIE, state, { httpOnly: true, secure: ENV.isProduction, sameSite: "lax", maxAge: 600, path: "/" });

  return new Response(null, { status: 302, headers });
}
