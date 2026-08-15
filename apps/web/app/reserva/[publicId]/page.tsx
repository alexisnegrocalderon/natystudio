import { Suspense } from "react";
import { BookingDetail } from "@/components/booking/BookingDetail";
import { noIndexMetadata } from "@/lib/seo";

export const metadata = {
  title: "Tu reserva",
  // Contiene datos personales de la clienta: nunca debe entrar al índice.
  ...noIndexMetadata,
};

export default async function BookingDetailPage({
  params,
}: {
  params: Promise<{ publicId: string }>;
}) {
  const { publicId } = await params;

  return (
    <section className="section-wrap" style={{ padding: "3.5rem 0 5rem", maxWidth: "700px" }}>
      <Suspense
        fallback={<p style={{ color: "var(--muted)" }}>Cargando tu reserva…</p>}
      >
        <BookingDetail publicId={publicId} />
      </Suspense>
    </section>
  );
}
