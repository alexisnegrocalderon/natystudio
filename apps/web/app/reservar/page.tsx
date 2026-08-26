import { Suspense } from "react";
import { BookingFunnel } from "@/components/booking/BookingFunnel";
import { noIndexMetadata } from "@/lib/seo";

export const metadata = {
  title: "Reservar hora",
  description: "Agenda tu hora en naty.studio, en Valparaíso o Providencia.",
  // El embudo no aporta nada a la búsqueda y sus URLs llevan parámetros de
  // estado: mantenerlo fuera del índice evita ruido y contenido duplicado.
  ...noIndexMetadata,
};

export default function BookingPage() {
  return (
    // useSearchParams obliga a delimitar el árbol con Suspense para que el
    // resto de la página pueda prerenderizarse.
    <Suspense
      fallback={
        <p className="section-wrap" style={{ color: "var(--muted)", padding: "3rem 0" }}>
          Cargando la agenda…
        </p>
      }
    >
      <BookingFunnel />
    </Suspense>
  );
}
