import { MapPin, Sparkles } from "lucide-react";
import Image from "next/image";
import { heroContent } from "@/content/natyContent";

/**
 * El retrato es opcional. Mientras no haya una fotografía propia alojada, el
 * marco se muestra con el monograma: es preferible a depender de un CDN externo
 * que puede dejar de servir la imagen y romper el hero.
 */
const PORTRAIT_URL = process.env.NEXT_PUBLIC_PORTRAIT_URL;

export function HeroPortrait() {
  return (
    <div className="hero-art reveal-up delay-1">
      <div className="hero-orb orb-one" aria-hidden="true" />
      <div className="hero-orb orb-two" aria-hidden="true" />

      <div className="portrait-frame">
        {PORTRAIT_URL ? (
          <Image
            src={PORTRAIT_URL}
            alt="Naty, enfermera estética en Valparaíso"
            width={420}
            height={420}
            priority
          />
        ) : (
          <span
            aria-hidden="true"
            style={{
              fontFamily: "var(--font-display)",
              fontSize: "clamp(4rem, 12vw, 7rem)",
              fontStyle: "italic",
              color: "rgba(42, 23, 32, .72)",
            }}
          >
            n
          </span>
        )}
      </div>

      <div className="floating-note note-top">
        <Sparkles size={16} aria-hidden="true" />
        <span>{heroContent.visualNote}</span>
      </div>
      <div className="floating-note note-bottom">
        <MapPin size={16} aria-hidden="true" />
        <span>{heroContent.location}</span>
      </div>
    </div>
  );
}
