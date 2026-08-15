import Link from "next/link";
import { noIndexMetadata } from "@/lib/seo";

export const metadata = {
  title: "Página no encontrada",
  ...noIndexMetadata,
};

export default function NotFound() {
  return (
    <section className="section-wrap" style={{ padding: "7rem 0", textAlign: "center" }}>
      <p className="eyebrow" style={{ justifyContent: "center" }}>
        Error 404
      </p>
      <h1 className="page-title" style={{ margin: "0 auto 1.4rem" }}>
        Esta página <em>no existe.</em>
      </h1>
      <p className="lede" style={{ margin: "0 auto 2rem" }}>
        Puede que el enlace haya cambiado. Desde el inicio encontrarás los servicios y la reserva de hora.
      </p>
      <div style={{ display: "flex", gap: ".8rem", justifyContent: "center", flexWrap: "wrap" }}>
        <Link className="primary-link" href="/">
          Volver al inicio
        </Link>
        <Link className="ghost-link" href="/servicios">
          Ver servicios
        </Link>
      </div>
    </section>
  );
}
