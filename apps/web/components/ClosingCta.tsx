import { ArrowUpRight } from "lucide-react";
import Link from "next/link";

export function ClosingCta({
  eyebrow = "¿Hablamos?",
  title = "Empecemos por una",
  accent = "conversación.",
  description = "Reserva tu hora en línea y recibe la confirmación por correo con todos los detalles.",
  action = "Agendar mi hora",
  href = "/reservar",
}: {
  eyebrow?: string;
  title?: string;
  accent?: string;
  description?: string;
  action?: string;
  href?: string;
}) {
  return (
    <section className="closing-cta section-wrap">
      <p className="eyebrow">{eyebrow}</p>
      <h2>
        {title} <em>{accent}</em>
      </h2>
      <p>{description}</p>
      <Link className="primary-link" href={href}>
        {action} <ArrowUpRight size={18} aria-hidden="true" />
      </Link>
    </section>
  );
}
