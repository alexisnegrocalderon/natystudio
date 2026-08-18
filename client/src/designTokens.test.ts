import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const stylesheet = readFileSync(resolve(process.cwd(), "client/src/index.css"), "utf8");

describe("sistema visual de Natalia Rodríguez Studio", () => {
  it("mantiene Pastel Pink como color base y conserva la escala rosa complementaria", () => {
    expect(stylesheet).toContain("--nr-pastel: #fdc3d1");
    expect(stylesheet).toContain("--nr-soft: #ffdbdb");
    expect(stylesheet).toContain("--nr-baby: #fda8bf");
    expect(stylesheet).toContain("--nr-tint: #fb8cac");
    expect(stylesheet).toContain("--nr-pink: #ff5c89");
  });

  it("aplica la dirección editorial bento y conserva los estados de interacción accesibles", () => {
    expect(stylesheet).toContain(".nr-site { overflow: clip; background: var(--nr-cream);");
    expect(stylesheet).toContain(".nr-hero { min-height: min(910px, 100svh);");
    expect(stylesheet).toContain(".nr-bento { display: grid;");
    expect(stylesheet).toContain(".nr-button:hover { transform: translateY(-2px);");
    expect(stylesheet).toContain(":focus-visible { outline: 3px solid var(--nr-pink);");
    expect(stylesheet).toContain("@media (prefers-reduced-motion: reduce)");
  });
});
