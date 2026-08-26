import { Instagram, MapPin, MessageCircle } from "lucide-react";
import { TransitionLink } from "@/components/TransitionLink";
import { footerContent } from "@/content/natyContent";
import { BUSINESS, NAV_LINKS } from "@/lib/site";

export function SiteFooter() {
  return (
    <footer className="site-footer">
      <div className="footer-top section-wrap">
        <div>
          <TransitionLink className="wordmark" href="/">
            naty<span>.</span>studio
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
            <p>
              <MapPin size={15} aria-hidden="true" /> {footerContent.location}
            </p>
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
        <p>Enfermera estética · Valparaíso, Chile</p>
      </div>
    </footer>
  );
}
