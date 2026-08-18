import { describe, expect, it } from "vitest";

describe("RESEND_API_KEY", () => {
  it("autentica una consulta mínima a Resend sin exponer la clave", async () => {
    const apiKey = process.env.RESEND_API_KEY;
    expect(apiKey).toBeTruthy();

    const response = await fetch("https://api.resend.com/domains", {
      headers: { Authorization: `Bearer ${apiKey}` },
    });

    // Una clave de tipo Sending access puede no tener permiso para listar dominios.
    // La respuesta 403 confirma que la clave fue autenticada, mientras 401 indica clave inválida.
    expect(response.status).not.toBe(401);
  }, 20_000);
});
