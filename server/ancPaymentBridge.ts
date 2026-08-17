import { createHmac } from "node:crypto";

type AncConnection = { provider: string; status: "draft" | "pending" | "active" | "restricted" | "disabled"; accountLabel?: string | null; updatedAt?: string | null } | null;

function config() {
  const baseUrl = process.env.ANC_PAYMENTS_BASE_URL?.trim().replace(/\/$/, "");
  const sourceKey = process.env.ANC_SALES_SOURCE_KEY?.trim();
  const sourceSecret = process.env.ANC_SALES_SOURCE_SECRET?.trim();
  if (!baseUrl || !sourceKey || !sourceSecret) throw new Error("La conexión central de pagos ANC aún no está configurada para este portal.");
  return { baseUrl, sourceKey, sourceSecret };
}

export function signAncPaymentPayload(secret: string, payload: string) {
  return `sha256=${createHmac("sha256", secret).update(payload).digest("hex")}`;
}

async function requestAncPaymentBridge<T>(path: string, action: "connect" | "status") {
  const { baseUrl, sourceKey, sourceSecret } = config();
  const body = JSON.stringify({ action, portal: "natalia-rodriguez-studio" });
  const response = await fetch(`${baseUrl}${path}`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-anc-source": sourceKey,
      "x-anc-signature": signAncPaymentPayload(sourceSecret, body),
    },
    body,
  });
  const payload = await response.json() as T & { error?: string };
  if (!response.ok) throw new Error(payload.error ?? "ANC no pudo completar la operación de pagos.");
  return payload;
}

export async function startNataliaMercadoPagoConnection() {
  return requestAncPaymentBridge<{ authorizationUrl: string; connectionId: number; connectionStatus: "pending" }>("/api/client/payments/mercadopago/connect", "connect");
}

export async function getNataliaMercadoPagoConnectionStatus() {
  return requestAncPaymentBridge<{ connection: AncConnection }>("/api/client/payments/mercadopago/status", "status");
}
