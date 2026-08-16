import React from "react";
import { Stethoscope } from "lucide-react";
import { getPilotCatalogSourceLabel } from "@/lib/landing";

type PilotService = {
  name: string;
  description: string;
  priceNote: string;
  durationNote: string;
};

type FallbackService = {
  title: string;
  description: string;
  value: string;
  duration: string;
};

export function PilotServiceCard({
  service,
  state,
  fallback,
  statusMessage,
  children,
}: {
  service?: PilotService;
  state: "loading" | "fallback" | "empty" | "ready";
  fallback: FallbackService;
  statusMessage: string;
  children: React.ReactNode;
}) {
  const sourceLabel = getPilotCatalogSourceLabel(state);

  return (
    <article id="procedimiento" className="intro-service">
      <span className="block-number">SERVICIO 01 · {sourceLabel}</span>
      <Stethoscope size={25} />
      <h3>{service?.name ?? fallback.title}</h3>
      <p>{service?.description ?? fallback.description}</p>
      <div className="intro-facts">
        <p><span>VALOR</span>{service?.priceNote ?? fallback.value}</p>
        <p><span>DURACIÓN</span>{service?.durationNote ?? fallback.duration}</p>
      </div>
      <p className={`pilot-status pilot-status--${state}`} role="status">{statusMessage}</p>
      {children}
    </article>
  );
}
