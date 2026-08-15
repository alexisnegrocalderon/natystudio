import { ArrowUpRight, HeartPulse } from "lucide-react";
import Link from "next/link";
import { formatClp, formatDuration } from "@naty/shared";

export type ServiceCardData = {
  slug: string;
  name: string;
  shortDescription: string;
  durationMin: number;
  priceClp: number;
  depositClp: number;
};

/**
 * Un precio en cero significa "todavía sin confirmar", no gratuito. Mostrar
 * "$0" haría dudar de la seriedad del sitio, así que se invita a consultar.
 */
export function priceLabel(priceClp: number): string {
  return priceClp > 0 ? formatClp(priceClp) : "Consulta el valor";
}

export function ServiceCard({ service, index }: { service: ServiceCardData; index: number }) {
  return (
    <article className="service-card">
      <div className="service-card-top">
        <span className="service-index">{String(index + 1).padStart(2, "0")}</span>
        <HeartPulse size={24} aria-hidden="true" />
      </div>

      <h3>
        <Link href={`/servicios/${service.slug}`}>{service.name}</Link>
      </h3>
      <p>{service.shortDescription}</p>

      <div className="service-meta">
        <p>
          <span>Valor</span>
          <strong>{priceLabel(service.priceClp)}</strong>
        </p>
        <p>
          <span>Duración</span>
          <strong>{formatDuration(service.durationMin)}</strong>
        </p>
      </div>

      <div style={{ display: "flex", gap: ".7rem", flexWrap: "wrap" }}>
        <Link className="primary-link" href={`/reservar?servicio=${service.slug}`}>
          Agendar <ArrowUpRight size={17} aria-hidden="true" />
        </Link>
        <Link className="ghost-link" href={`/servicios/${service.slug}`}>
          Ver detalle
        </Link>
      </div>
    </article>
  );
}
