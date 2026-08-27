import { Instagram, MapPin, MessageCircle } from "lucide-react";
import Image from "next/image";
import { TransitionLink } from "@/components/TransitionLink";
import { footerContent } from "@/content/natyContent";
import { BUSINESS, LOCATIONS, NAV_LINKS } from "@/lib/site";

export function SiteFooter() {
  return (
    <footer className="site-footer">
      <div className="footer-top section-wrap">
        <div>
          <TransitionLink className="wordmark" href="/" aria-label="Natalia Rodríguez Studio, ir al inicio">
            <Image src="/logo-black.png" alt="Natalia Rodríguez Studio" width={1519} height={572} />
          </TransitionLink>
          <p style={{ color: "var(--muted)", fontSize: ".84rem", lineHeight: 1.7, marginTop: "1rem", maxWidth: "290px" }}>
            {footerContent.description}
          </p>
        </div>

        <div>
          <h3>Navegación</h3>
          <div className="footer-nav">
            {NAV_LINKS.map(link => (
              <TransitionLink key={link.href} href={link.href}>
                {link.label}
              </TransitionLink>
            ))}
            <TransitionLink href="/reservar">Agendar hora</TransitionLink>
          </div>
        </div>

        <div>
          <h3>Contacto</h3>
          <div className="footer-contact">
            {LOCATIONS.map(location => (
              <p key={location.slug}>
                <MapPin size={15} aria-hidden="true" /> {location.city}, Chile
              </p>
            ))}
            <a href={BUSINESS.whatsapp} target="_blank" rel="noreferrer">
              <MessageCircle size={15} aria-hidden="true" /> WhatsApp
            </a>
            <a href={BUSINESS.instagram} target="_blank" rel="noreferrer">
              <Instagram size={15} aria-hidden="true" /> Instagram
            </a>
          </div>
        </div>
      </div>

      <div className="footer-bottom section-wrap">
        <p>© {new Date().getFullYear()} naty.studio</p>
        <p>Enfermera estética · Valparaíso y Providencia, Chile</p>
      </div>
    </footer>
  );
}
