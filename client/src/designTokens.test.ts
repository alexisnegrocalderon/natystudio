import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const stylesheet = readFileSync(resolve(process.cwd(), "client/src/index.css"), "utf8");

describe("sistema visual de Natalia Rodríguez Studio", () => {
  it("mantiene Pastel Pink como color base y conserva la escala rosa complementaria", () => {
    expect(stylesheet).toContain("--pastel-pink: #fdc3d1");
    expect(stylesheet).toContain("--soft-blush: #ffdbdb");
    expect(stylesheet).toContain("--baby-pink: #fda8bf");
    expect(stylesheet).toContain("--bubblegum-tint: #fb8cac");
    expect(stylesheet).toContain("--bubblegum-pink: #ff5c89");
  });

  it("aplica la nueva dirección visual a la experiencia pública y a sus estados de interacción", () => {
    expect(stylesheet).toContain(".nr-site { overflow: hidden; background: var(--pastel-pink);");
    expect(stylesheet).toContain(".nr-hero { display: grid;");
    expect(stylesheet).toContain(".nr-cta:hover { transform: translateY(-2px); background: var(--bubblegum-pink);");
    expect(stylesheet).toContain(":focus-visible { outline: 3px solid var(--bubblegum-pink);");
  });
});
