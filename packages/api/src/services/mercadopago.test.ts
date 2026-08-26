import { createHmac } from "node:crypto";
import { TRPCError } from "@trpc/server";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createMpPayment, getMpPayment, mapMpStatus, rejectionMessage, verifyWebhookSignature } from "./mercadopago";

const SECRET = "un-secreto-de-prueba";

function sign(manifest: string, secret = SECRET): string {
  return createHmac("sha256", secret).update(manifest).digest("hex");
}

describe("verifyWebhookSignature", () => {
  it("acepta una firma armada con el manifiesto correcto", () => {
    const ts = "1700000000";
    const dataId = "123456789";
    const v1 = sign(`id:${dataId};request-id:req-1;ts:${ts};`);

    expect(
      verifyWebhookSignature({
        signatureHeader: `ts=${ts},v1=${v1}`,
        requestId: "req-1",
        dataId,
        secret: SECRET,
      }),
    ).toBe(true);
  });

  it("pone en minúsculas un data.id alfanumérico antes de firmar", () => {
    const ts = "1700000000";
    const dataId = "AbC123";
    const v1 = sign(`id:${dataId.toLowerCase()};request-id:req-1;ts:${ts};`);

    expect(
      verifyWebhookSignature({
        signatureHeader: `ts=${ts},v1=${v1}`,
        requestId: "req-1",
        dataId,
        secret: SECRET,
      }),
    ).toBe(true);
  });

  it("rechaza con el secreto equivocado", () => {
    const ts = "1700000000";
    const dataId = "123";
    const v1 = sign(`id:${dataId};request-id:req-1;ts:${ts};`, "otro-secreto");

    expect(
      verifyWebhookSignature({ signatureHeader: `ts=${ts},v1=${v1}`, requestId: "req-1", dataId, secret: SECRET }),
    ).toBe(false);
  });

  it("rechaza si el data.id fue alterado respecto al firmado", () => {
    const ts = "1700000000";
    const v1 = sign(`id:123;request-id:req-1;ts:${ts};`);

    expect(
      verifyWebhookSignature({ signatureHeader: `ts=${ts},v1=${v1}`, requestId: "req-1", dataId: "456", secret: SECRET }),
    ).toBe(false);
  });

  it("rechaza sin el segmento ts", () => {
    expect(
      verifyWebhookSignature({ signatureHeader: "v1=abc123", requestId: "req-1", dataId: "123", secret: SECRET }),
    ).toBe(false);
  });

  it("rechaza sin el segmento v1", () => {
    expect(
      verifyWebhookSignature({ signatureHeader: "ts=1700000000", requestId: "req-1", dataId: "123", secret: SECRET }),
    ).toBe(false);
  });

  it("rechaza una firma de largo distinto sin lanzar", () => {
    expect(() =>
      verifyWebhookSignature({
        signatureHeader: "ts=1700000000,v1=corta",
        requestId: "req-1",
        dataId: "123",
        secret: SECRET,
      }),
    ).not.toThrow();
    expect(
      verifyWebhookSignature({
        signatureHeader: "ts=1700000000,v1=corta",
        requestId: "req-1",
        dataId: "123",
        secret: SECRET,
      }),
    ).toBe(false);
  });

  it("rechaza sin cabecera", () => {
    expect(verifyWebhookSignature({ signatureHeader: null, requestId: "req-1", dataId: "123", secret: SECRET })).toBe(
      false,
    );
  });
});

describe("mapMpStatus", () => {
  it.each([
    ["approved", "approved"],
    ["authorized", "approved"],
    ["pending", "pending"],
    ["in_process", "pending"],
    ["in_mediation", "pending"],
    ["rejected", "rejected"],
    ["cancelled", "cancelled"],
    ["expired", "cancelled"],
    ["refunded", "refunded"],
    ["charged_back", "refunded"],
  ] as const)("%s → %s", (input, expected) => {
    expect(mapMpStatus(input)).toBe(expected);
  });

  it("un estado desconocido nunca se mapea a approved", () => {
    expect(mapMpStatus("algo_que_mercado_pago_invente_despues")).toBe("pending");
  });
});

describe("rejectionMessage", () => {
  it("traduce un motivo conocido", () => {
    expect(rejectionMessage("cc_rejected_insufficient_amount")).toMatch(/fondos suficientes/);
  });

  it("cae a un mensaje genérico ante un motivo desconocido", () => {
    expect(rejectionMessage("algo_nuevo")).toMatch(/rechazado/);
  });
});

const validPaymentInput = {
  amountClp: 15_000,
  token: "tok",
  paymentMethodId: "visa",
  installments: 1,
  payerEmail: "clienta@mail.com",
  description: "Abono",
  externalReference: "pub123",
  metadata: {},
  idempotencyKey: "pub123:1",
};

describe("ramas de error HTTP", () => {
  it("una respuesta 401 lanza TRPCError y no entrega un pago aprobado", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(new Response(JSON.stringify({ message: "invalid token" }), { status: 401 })),
    );
    await expect(createMpPayment(validPaymentInput)).rejects.toBeInstanceOf(TRPCError);
  });

  it("una respuesta 500 lanza TRPCError", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("{}", { status: 500 })));
    await expect(getMpPayment("123")).rejects.toBeInstanceOf(TRPCError);
  });

  it("un cuerpo que no es JSON lanza TRPCError", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("no es json", { status: 200 })));
    await expect(getMpPayment("123")).rejects.toBeInstanceOf(TRPCError);
  });

  it("una caída de red lanza TRPCError", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockRejectedValue(new Error("network down")),
    );
    await expect(getMpPayment("123")).rejects.toBeInstanceOf(TRPCError);
  });

  it("rechaza un monto no entero antes de llamar a la red", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    await expect(createMpPayment({ ...validPaymentInput, amountClp: 15_000.5 })).rejects.toBeInstanceOf(TRPCError);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

afterEach(() => {
  vi.unstubAllGlobals();
});
