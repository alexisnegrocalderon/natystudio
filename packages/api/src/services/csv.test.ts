import { describe, expect, it } from "vitest";
import { buildCsv } from "./csv";

describe("buildCsv", () => {
  it("separa columnas con punto y coma", () => {
    const csv = buildCsv(["Nombre", "Correo"], [["María", "maria@mail.com"]]);
    expect(csv).toContain("Nombre;Correo");
    expect(csv).toContain("María;maria@mail.com");
  });

  it("empieza con BOM para que Excel detecte UTF-8", () => {
    const csv = buildCsv(["a"], [["b"]]);
    expect(csv.charCodeAt(0)).toBe(0xfeff);
  });

  it("entrecomilla un campo que contiene el separador", () => {
    const csv = buildCsv(["Notas"], [["Alérgica; revisar antes"]]);
    expect(csv).toContain('"Alérgica; revisar antes"');
  });

  it("duplica las comillas internas", () => {
    const csv = buildCsv(["Notas"], [['Dijo "no puedo" el lunes']]);
    expect(csv).toContain('"Dijo ""no puedo"" el lunes"');
  });

  it("entrecomilla un campo con salto de línea", () => {
    const csv = buildCsv(["Notas"], [["Línea 1\nLínea 2"]]);
    expect(csv).toContain('"Línea 1\nLínea 2"');
  });

  it("no entrecomilla un campo sin caracteres especiales", () => {
    const csv = buildCsv(["Nombre"], [["María José"]]);
    expect(csv).toContain("María José");
    expect(csv).not.toContain('"María José"');
  });

  it("termina cada fila en CRLF", () => {
    const csv = buildCsv(["a"], [["1"], ["2"]]);
    expect(csv).toContain("1\r\n2\r\n");
  });
});
