/**
 * Inserta datos estructurados schema.org.
 *
 * El contenido se serializa con JSON.stringify y se escapan las secuencias que
 * podrían cerrar el <script> antes de tiempo; sin eso, un texto que Naty
 * escriba en el panel podría inyectar HTML en la página.
 */
export function JsonLd({ data }: { data: object }) {
  const json = JSON.stringify(data)
    .replace(/</g, "\\u003c")
    .replace(/>/g, "\\u003e")
    .replace(/&/g, "\\u0026");

  return <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: json }} />;
}
