import * as React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import NataliaAdmin, { LoginPanel } from "./NataliaAdmin";

describe("NataliaAdmin", () => {
  it("muestra un estado de carga mientras comprueba la sesión privada", () => {
    const html = renderToStaticMarkup(<NataliaAdmin />);

    expect(html).toContain("Cargando tu espacio privado…");
  });

  it("presenta el acceso administrativo con etiquetas, campos y acción principal", () => {
    const html = renderToStaticMarkup(<LoginPanel onLogin={() => undefined} />);

    expect(html).toContain("Panel privado");
    expect(html).toContain("Correo");
    expect(html).toContain("Contraseña");
    expect(html).toContain("Entrar a mi administración");
  });
});
