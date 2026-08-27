import { describe, expect, it } from "vitest";
import {
  HOLD_TIMEOUT_MS,
  STUCK_PAYMENT_TIMEOUT_MS,
  nextAppointmentState,
  resolveChargeAmount,
  resolvePaymentPlan,
  shouldReleaseHold,
} from "./payments";

describe("resolvePaymentPlan", () => {
  it("sin pagos activados, no requiere pago", () => {
    expect(resolvePaymentPlan([{ priceClp: 50_000, depositPercent: 20 }], false)).toEqual({ required: false });
  });

  it("con precio en 0 (Consulta el valor), no requiere pago aunque los pagos estén activados", () => {
    expect(resolvePaymentPlan([{ priceClp: 0, depositPercent: 60 }], true)).toEqual({ required: false });
  });

  it("con abono al 100%, sólo ofrece pagar el total", () => {
    expect(resolvePaymentPlan([{ priceClp: 50_000, depositPercent: 100 }], true)).toEqual({
      required: true,
      fullClp: 50_000,
      depositClp: null,
    });
  });

  it("con abono entre 0 y el precio, ofrece elegir", () => {
    expect(resolvePaymentPlan([{ priceClp: 50_000, depositPercent: 30 }], true)).toEqual({
      required: true,
      fullClp: 50_000,
      depositClp: 15_000,
    });
  });

  it("con varios servicios, suma el precio y el abono de cada uno sobre su propio precio", () => {
    expect(
      resolvePaymentPlan(
        [
          { priceClp: 50_000, depositPercent: 60 },
          { priceClp: 30_000, depositPercent: 80 },
        ],
        true,
      ),
    ).toEqual({
      required: true,
      fullClp: 80_000,
      // round(50000*0.6) + round(30000*0.8) = 30000 + 24000
      depositClp: 54_000,
    });
  });
});

describe("resolveChargeAmount", () => {
  const plan = { required: true as const, fullClp: 50_000, depositClp: 15_000 };

  it("cobra el total pedido", () => {
    expect(resolveChargeAmount(plan, "full")).toBe(50_000);
  });

  it("cobra el abono pedido", () => {
    expect(resolveChargeAmount(plan, "deposit")).toBe(15_000);
  });

  it("rechaza pedir abono cuando el plan no lo ofrece", () => {
    expect(() => resolveChargeAmount({ required: true, fullClp: 50_000, depositClp: null }, "deposit")).toThrow();
  });
});

describe("nextAppointmentState", () => {
  it("un pago no aprobado nunca cambia el estado de la cita", () => {
    for (const status of ["pending", "rejected", "cancelled", "refunded"] as const) {
      expect(nextAppointmentState("pending_payment", status)).toEqual({
        appointmentStatus: "pending_payment",
        refundNeeded: false,
      });
    }
  });

  it("aprobado sobre pending_payment confirma la cita", () => {
    expect(nextAppointmentState("pending_payment", "approved")).toEqual({
      appointmentStatus: "confirmed",
      refundNeeded: false,
    });
  });

  it("aprobado sobre pending_approval confirma la cita", () => {
    expect(nextAppointmentState("pending_approval", "approved")).toEqual({
      appointmentStatus: "confirmed",
      refundNeeded: false,
    });
  });

  it("aprobado sobre una cita ya confirmada no la duplica", () => {
    expect(nextAppointmentState("confirmed", "approved")).toEqual({
      appointmentStatus: "confirmed",
      refundNeeded: false,
    });
  });

  it("aprobado sobre una cita cancelada no la resucita, y marca revisión", () => {
    expect(nextAppointmentState("cancelled", "approved")).toEqual({
      appointmentStatus: "cancelled",
      refundNeeded: true,
    });
  });

  it("aprobado sobre una cita ya realizada tampoco la reabre", () => {
    expect(nextAppointmentState("completed", "approved")).toEqual({
      appointmentStatus: "completed",
      refundNeeded: true,
    });
  });
});

describe("shouldReleaseHold", () => {
  const now = new Date("2026-01-01T12:00:00Z");

  it("sin pagos y menos de 15 minutos: se mantiene", () => {
    const createdAt = new Date(now.getTime() - 5 * 60_000);
    expect(shouldReleaseHold({ createdAt, payments: [], now })).toBe("keep");
  });

  it("sin pagos y más de 15 minutos: se libera", () => {
    const createdAt = new Date(now.getTime() - HOLD_TIMEOUT_MS - 1000);
    expect(shouldReleaseHold({ createdAt, payments: [], now })).toBe("release");
  });

  it("con un pago pending reciente: se mantiene aunque pasen los 15 minutos normales", () => {
    const createdAt = new Date(now.getTime() - HOLD_TIMEOUT_MS - 1000);
    expect(shouldReleaseHold({ createdAt, payments: [{ status: "pending" }], now })).toBe("keep");
  });

  it("con un pago pending viejo (24h+): se libera y se cancela en Mercado Pago", () => {
    const createdAt = new Date(now.getTime() - STUCK_PAYMENT_TIMEOUT_MS - 1000);
    expect(shouldReleaseHold({ createdAt, payments: [{ status: "pending" }], now })).toBe("release-and-cancel-mp");
  });

  it("con un pago approved: siempre se mantiene, sin importar la edad", () => {
    const createdAt = new Date(now.getTime() - STUCK_PAYMENT_TIMEOUT_MS - 1000);
    expect(shouldReleaseHold({ createdAt, payments: [{ status: "approved" }], now })).toBe("keep");
  });

  it("con un pago rejected y nada más: se comporta como si no hubiera pago", () => {
    const createdAt = new Date(now.getTime() - HOLD_TIMEOUT_MS - 1000);
    expect(shouldReleaseHold({ createdAt, payments: [{ status: "rejected" }], now })).toBe("release");
  });
});
