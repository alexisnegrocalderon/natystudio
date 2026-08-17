import { describe, expect, it } from "vitest";
import { ancPreviewBypassHeaders, signAncPaymentPayload } from "./ancPaymentBridge";

describe("signAncPaymentPayload", () => {
  it("crea una firma server-side para ANC sin usar una credencial de Mercado Pago", () => {
    expect(signAncPaymentPayload("source-secret", '{"action":"status"}')).toMatch(/^sha256=[a-f0-9]{64}$/);
  });
});

describe("ancPreviewBypassHeaders", () => {
  it("omite el bypass cuando no hay secreto configurado", () => {
    const previous = process.env.ANC_VERCEL_BYPASS_SECRET;
    delete process.env.ANC_VERCEL_BYPASS_SECRET;
    expect(ancPreviewBypassHeaders()).toEqual({});
    process.env.ANC_VERCEL_BYPASS_SECRET = previous;
  });

  it("envía el bypass solo desde el servidor cuando está configurado", () => {
    const previous = process.env.ANC_VERCEL_BYPASS_SECRET;
    process.env.ANC_VERCEL_BYPASS_SECRET = "preview-bypass";
    expect(ancPreviewBypassHeaders()).toEqual({ "x-vercel-protection-bypass": "preview-bypass" });
    process.env.ANC_VERCEL_BYPASS_SECRET = previous;
  });
});
