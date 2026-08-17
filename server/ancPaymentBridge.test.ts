import { describe, expect, it } from "vitest";
import { signAncPaymentPayload } from "./ancPaymentBridge";

describe("signAncPaymentPayload", () => {
  it("crea una firma server-side para ANC sin usar una credencial de Mercado Pago", () => {
    expect(signAncPaymentPayload("source-secret", '{"action":"status"}')).toMatch(/^sha256=[a-f0-9]{64}$/);
  });
});
