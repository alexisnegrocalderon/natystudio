import { ENV } from "@naty/api/env";
import { getMpPayment, verifyWebhookSignature } from "@naty/api/services/mercadopago";
import { getSellerAccessToken } from "@naty/api/services/mercadopago-connection";
import { applyPaymentResult, findPaymentRowForMpPayment } from "@naty/api/services/payments";

// El driver `pg` necesita un socket TCP real, que no existe en el runtime Edge.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Webhook de Mercado Pago. Reglas no negociables:
 * 1. Se valida la firma antes de tocar nada.
 * 2. El cuerpo nunca se usa como fuente de verdad: sólo trae el id, el estado
 *    real se relee de la API de Mercado Pago.
 * 3. Es idempotente en varias capas (ver `applyPaymentResult`), así que un
 *    mismo aviso repetido no duplica ni pierde nada.
 * 4. Responde rápido: Mercado Pago reintenta si tarda más de ~22 segundos.
 */
export async function POST(req: Request): Promise<Response> {
  if (!ENV.paymentsEnabled) {
    return Response.json({ ok: true, ignored: true }, { status: 200 });
  }

  // El cuerpo se lee crudo primero: no se parsea nada antes de verificar la firma.
  const raw = await req.text();

  const url = new URL(req.url);
  const dataId = url.searchParams.get("data.id") ?? extractDataId(raw);
  const type = url.searchParams.get("type") ?? extractType(raw);

  const valid = verifyWebhookSignature({
    signatureHeader: req.headers.get("x-signature"),
    requestId: req.headers.get("x-request-id"),
    dataId,
    secret: ENV.mercadoPago.webhookSecret,
  });

  if (!valid) {
    return Response.json({ error: "Firma inválida" }, { status: 401 });
  }

  if (type !== "payment" || !dataId) {
    return Response.json({ ok: true, ignored: true }, { status: 200 });
  }

  try {
    const mp = await getMpPayment(dataId, await getSellerAccessToken());
    const paymentRowId = await findPaymentRowForMpPayment(mp);

    if (paymentRowId === null) {
      // Un pago que no corresponde a ninguna reserva nuestra: se responde 200
      // igual, para que Mercado Pago no siga reintentando en vano.
      return Response.json({ ok: true, ignored: true }, { status: 200 });
    }

    const result = await applyPaymentResult({ paymentRowId, mp });
    return Response.json({ ok: true, changed: result.changed }, { status: 200 });
  } catch (error) {
    console.error("[webhook mercadopago] error procesando el aviso:", error);
    // 500 para que Mercado Pago reintente: un fallo transitorio (Neon
    // despertando, por ejemplo) no debe perder el aviso.
    return Response.json({ error: "Error interno" }, { status: 500 });
  }
}

function extractDataId(raw: string): string | null {
  try {
    const body = JSON.parse(raw) as { data?: { id?: string | number } };
    return body.data?.id !== undefined ? String(body.data.id) : null;
  } catch {
    return null;
  }
}

function extractType(raw: string): string | null {
  try {
    const body = JSON.parse(raw) as { type?: string };
    return body.type ?? null;
  } catch {
    return null;
  }
}
