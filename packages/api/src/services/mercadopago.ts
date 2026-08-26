import { createHmac, timingSafeEqual } from "node:crypto";
import { TRPCError } from "@trpc/server";
import type { PaymentStatus } from "@naty/shared";
import { ENV } from "../env";

const API_BASE = "https://api.mercadopago.com";

export type MpPayment = {
  id: number;
  status: string;
  status_detail: string;
  transaction_amount: number;
  external_reference?: string;
  payment_method_id?: string;
  metadata?: Record<string, unknown>;
};

/* ------------------------------------------------------------- webhook --- */

/** `x-signature: ts=169...,v1=618f3b3b...` → { ts, v1 }. Nulo si falta alguna parte. */
function parseSignatureHeader(header: string | null): { ts: string; v1: string } | null {
  if (!header) return null;

  let ts: string | undefined;
  let v1: string | undefined;
  for (const part of header.split(",")) {
    const [key, value] = part.split("=").map(piece => piece?.trim());
    if (key === "ts") ts = value;
    if (key === "v1") v1 = value;
  }

  return ts && v1 ? { ts, v1 } : null;
}

/**
 * Reconstruye el manifiesto exacto que Mercado Pago firma y compara el
 * HMAC-SHA256 en tiempo constante. El `data.id` se pasa siempre en minúsculas:
 * es la causa clásica de que la firma valide en pruebas y falle en producción
 * cuando el id trae letras.
 */
export function verifyWebhookSignature(args: {
  signatureHeader: string | null;
  requestId: string | null;
  dataId: string | null;
  secret: string;
}): boolean {
  const parsed = parseSignatureHeader(args.signatureHeader);
  if (!parsed || !args.dataId || !args.secret) return false;

  const manifest = `id:${args.dataId.toLowerCase()};request-id:${args.requestId ?? ""};ts:${parsed.ts};`;
  const expected = createHmac("sha256", args.secret).update(manifest).digest("hex");

  const expectedBuffer = Buffer.from(expected);
  const givenBuffer = Buffer.from(parsed.v1);
  if (expectedBuffer.length !== givenBuffer.length) return false;

  return timingSafeEqual(expectedBuffer, givenBuffer);
}

/* --------------------------------------------------------------- estado --- */

/**
 * A un estado desconocido de Mercado Pago nunca se le asigna "approved": si
 * la API introduce un estado nuevo que no contemplamos, el pago se trata como
 * pendiente (el reconciliador lo revisará de nuevo) en vez de confirmarse
 * solo por no reconocer el texto.
 */
export function mapMpStatus(status: string): PaymentStatus {
  switch (status) {
    case "approved":
    case "authorized":
      return "approved";
    case "rejected":
      return "rejected";
    case "cancelled":
    case "expired":
      return "cancelled";
    case "refunded":
    case "charged_back":
      return "refunded";
    case "pending":
    case "in_process":
    case "in_mediation":
    default:
      return "pending";
  }
}

const REJECTION_MESSAGES: Record<string, string> = {
  cc_rejected_insufficient_amount: "Tu tarjeta no tiene fondos suficientes.",
  cc_rejected_bad_filled_security_code: "Revisa el código de seguridad de tu tarjeta.",
  cc_rejected_bad_filled_date: "Revisa la fecha de vencimiento de tu tarjeta.",
  cc_rejected_bad_filled_other: "Revisa los datos de tu tarjeta.",
  cc_rejected_bad_filled_card_number: "Revisa el número de tu tarjeta.",
  cc_rejected_call_for_authorize: "Tu banco requiere que autorices el pago directamente con ellos.",
  cc_rejected_card_disabled: "Tu tarjeta está deshabilitada. Contacta a tu banco o prueba con otra.",
  cc_rejected_duplicated_payment: "Ya intentaste pagar este mismo monto hace poco.",
  cc_rejected_high_risk: "El pago fue rechazado por seguridad. Prueba con otro medio de pago.",
  cc_rejected_max_attempts: "Alcanzaste el máximo de intentos con esta tarjeta.",
  cc_rejected_other_reason: "Tu banco rechazó el pago. Prueba con otra tarjeta.",
};

export function rejectionMessage(statusDetail: string): string {
  return REJECTION_MESSAGES[statusDetail] ?? "El pago fue rechazado. Prueba con otro medio de pago.";
}

/* ----------------------------------------------------------------- API --- */

async function mpFetch(path: string, init: RequestInit): Promise<MpPayment> {
  let response: Response;
  try {
    response = await fetch(`${API_BASE}${path}`, {
      ...init,
      headers: {
        Authorization: `Bearer ${ENV.mercadoPago.accessToken}`,
        "Content-Type": "application/json",
        ...init.headers,
      },
    });
  } catch (error) {
    throw new TRPCError({
      code: "BAD_GATEWAY",
      message: "No se pudo contactar a Mercado Pago. Intenta de nuevo en un momento.",
      cause: error,
    });
  }

  let body: unknown;
  try {
    body = await response.json();
  } catch (error) {
    throw new TRPCError({
      code: "BAD_GATEWAY",
      message: "Mercado Pago respondió algo inesperado.",
      cause: error,
    });
  }

  if (!response.ok) {
    throw new TRPCError({
      code: "BAD_GATEWAY",
      message: "Mercado Pago rechazó la solicitud.",
      cause: body,
    });
  }

  return body as MpPayment;
}

export async function createMpPayment(input: {
  amountClp: number;
  token: string;
  paymentMethodId: string;
  issuerId?: string | number;
  installments: number;
  payerEmail: string;
  payerIdentification?: { type: string; number: string };
  description: string;
  externalReference: string;
  metadata: Record<string, unknown>;
  idempotencyKey: string;
}): Promise<MpPayment> {
  if (!Number.isInteger(input.amountClp) || input.amountClp <= 0) {
    throw new TRPCError({ code: "BAD_REQUEST", message: "El monto a cobrar no es válido." });
  }

  return mpFetch("/v1/payments", {
    method: "POST",
    headers: { "X-Idempotency-Key": input.idempotencyKey },
    body: JSON.stringify({
      transaction_amount: input.amountClp,
      token: input.token,
      payment_method_id: input.paymentMethodId,
      issuer_id: input.issuerId,
      installments: input.installments,
      description: input.description,
      external_reference: input.externalReference,
      metadata: input.metadata,
      notification_url: `${ENV.siteUrl}/api/webhooks/mercadopago`,
      payer: {
        email: input.payerEmail,
        identification: input.payerIdentification,
      },
    }),
  });
}

export async function getMpPayment(id: string | number): Promise<MpPayment> {
  return mpFetch(`/v1/payments/${id}`, { method: "GET" });
}

export async function cancelMpPayment(id: string | number): Promise<MpPayment> {
  return mpFetch(`/v1/payments/${id}`, { method: "PUT", body: JSON.stringify({ status: "cancelled" }) });
}
