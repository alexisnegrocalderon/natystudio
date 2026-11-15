import { describe, expect, it } from "vitest";
import { buildSaleEvent, retryDelayMs, signSaleBody } from "./sales-events";

describe("buildSaleEvent", () => {
  const payment = { id: 42, amountClp: 20_800, feeClp: 800 };
  const now = new Date("2026-11-16T15:00:00.000Z");

  it("informa lo pagado y la base de comisión sin cargos", () => {
    const body = buildSaleEvent(payment, "paid", now, now);
    expect(body).toMatchObject({
      externalSaleId: "pay-42",
      status: "paid",
      grossAmount: "20800.00",
      commissionBase: "20000.00",
      currency: "CLP",
      occurredAt: "2026-11-16T15:00:00.000Z",
      paidAt: "2026-11-16T15:00:00.000Z",
    });
  });

  it("una devolución conserva el mismo id de venta y no trae paidAt", () => {
    const body = buildSaleEvent(payment, "refunded", now);
    expect(body.externalSaleId).toBe("pay-42");
    expect(body.status).toBe("refunded");
    expect("paidAt" in body).toBe(false);
  });
});

describe("firma", () => {
  it("es sha256=<hex> y cambia con el cuerpo o el secreto", () => {
    const a = signSaleBody("s1", '{"a":1}');
    expect(a).toMatch(/^sha256=[0-9a-f]{64}$/);
    expect(signSaleBody("s1", '{"a":2}')).not.toBe(a);
    expect(signSaleBody("s2", '{"a":1}')).not.toBe(a);
    expect(signSaleBody("s1", '{"a":1}')).toBe(a);
  });
});

describe("retryDelayMs", () => {
  it("duplica la espera y se detiene en una hora", () => {
    expect(retryDelayMs(1)).toBe(2 * 60_000);
    expect(retryDelayMs(3)).toBe(8 * 60_000);
    expect(retryDelayMs(20)).toBe(60 * 60_000);
  });
});
