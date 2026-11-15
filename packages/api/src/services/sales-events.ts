import { createHmac } from "node:crypto";

/**
 * Parte pura del envío de ventas al panel de ANC (sin base de datos, para poder
 * probarla sin `DATABASE_URL`). El contrato: cuerpo JSON firmado con
 * HMAC-SHA256 en `x-anc-signature`; el panel decide la comisión.
 */

export type SaleEventKind = "paid" | "refunded";

export type SaleEventPayment = { id: number; amountClp: number; feeClp: number };

export type SaleEventBody = {
  externalSaleId: string;
  status: SaleEventKind;
  grossAmount: string;
  commissionBase: string;
  currency: "CLP";
  occurredAt: string;
  paidAt?: string;
};

const clp = (value: number) => `${value}.00`;

/**
 * `grossAmount` es lo que pagó la clienta; `commissionBase` es sólo la parte
 * que le corresponde a Naty (sin comisiones de Mercado Pago ni de la
 * plataforma): sobre ella el panel calcula el 1,5 %.
 */
export function buildSaleEvent(
  payment: SaleEventPayment,
  kind: SaleEventKind,
  now: Date,
  paidAt?: Date,
): SaleEventBody {
  return {
    externalSaleId: `pay-${payment.id}`,
    status: kind,
    grossAmount: clp(payment.amountClp),
    commissionBase: clp(payment.amountClp - payment.feeClp),
    currency: "CLP",
    occurredAt: now.toISOString(),
    ...(paidAt ? { paidAt: paidAt.toISOString() } : {}),
  };
}

export function signSaleBody(secret: string, body: string): string {
  return `sha256=${createHmac("sha256", secret).update(body).digest("hex")}`;
}

/** Espera antes del siguiente intento: 1, 2, 4… minutos, con tope de una hora. */
export function retryDelayMs(attempts: number): number {
  return Math.min(2 ** Math.max(0, attempts), 60) * 60_000;
}
