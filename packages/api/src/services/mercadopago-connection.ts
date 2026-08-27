import { eq } from "drizzle-orm";
import { db, mercadoPagoConnection } from "../db";
import { exchangeMpAuthorizationCode, fetchMpAccountEmail, refreshMpSellerToken } from "./mercadopago";

/**
 * Todo lo que toca la fila `mercado_pago_connection` vive en este archivo
 * aparte (no en `mercadopago.ts`) para que las funciones puras del cliente
 * de Mercado Pago (cálculo de comisiones, mapeo de estados, verificación de
 * firma) se puedan importar y testear sin necesitar `DATABASE_URL` — `db`
 * se conecta apenas se importa el módulo.
 */

/**
 * Cierra el flujo de OAuth: cambia el `code` por tokens y guarda la conexión
 * (reemplazando cualquier conexión previa — sólo hay una cuenta conectada a
 * la vez).
 */
export async function completeMpConnection(code: string, redirectUri: string): Promise<void> {
  const token = await exchangeMpAuthorizationCode(code, redirectUri);
  const email = await fetchMpAccountEmail(token.access_token);

  await db.transaction(async tx => {
    await tx.delete(mercadoPagoConnection).where(eq(mercadoPagoConnection.id, 1));
    await tx.insert(mercadoPagoConnection).values({
      id: 1,
      sellerAccessToken: token.access_token,
      sellerRefreshToken: token.refresh_token,
      sellerUserId: String(token.user_id),
      sellerEmail: email,
      tokenExpiresAt: new Date(Date.now() + token.expires_in * 1000),
    });
  });
}

/** Margen antes de que expire el token para renovarlo, no esperar a que ya haya vencido. */
const TOKEN_REFRESH_MARGIN_MS = 10 * 60_000;

/**
 * Token vigente de la cuenta conectada de Naty, renovándolo solo si está por
 * vencer. Devuelve `undefined` si nunca se conectó — quien llama cae al token
 * fijo de `MP_ACCESS_TOKEN` (si existe) en ese caso.
 */
export async function getSellerAccessToken(): Promise<string | undefined> {
  const [connection] = await db.select().from(mercadoPagoConnection).where(eq(mercadoPagoConnection.id, 1)).limit(1);
  if (!connection) return undefined;

  if (connection.tokenExpiresAt.getTime() - Date.now() > TOKEN_REFRESH_MARGIN_MS) {
    return connection.sellerAccessToken;
  }

  try {
    const refreshed = await refreshMpSellerToken(connection.sellerRefreshToken);
    await db
      .update(mercadoPagoConnection)
      .set({
        sellerAccessToken: refreshed.access_token,
        sellerRefreshToken: refreshed.refresh_token,
        tokenExpiresAt: new Date(Date.now() + refreshed.expires_in * 1000),
        updatedAt: new Date(),
      })
      .where(eq(mercadoPagoConnection.id, 1));
    return refreshed.access_token;
  } catch (error) {
    // Si la renovación falla, seguimos con el token que había — puede que aún
    // sirva un rato más; si ya venció de verdad, Mercado Pago rechazará el
    // cobro y quedará claro en el error, en vez de romper la reserva acá.
    console.error("[mercadopago] no se pudo renovar el token de la cuenta conectada:", error);
    return connection.sellerAccessToken;
  }
}
