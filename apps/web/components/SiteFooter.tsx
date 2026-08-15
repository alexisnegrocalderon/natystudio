import { Instagram, MapPin, MessageCircle } from "lucide-react";
import Link from "next/link";
import { footerContent } from "@/content/natyContent";
import { BUSINESS, NAV_LINKS } from "@/lib/site";

export function SiteFooter() {
  return (
    <footer className="site-footer">
      <div className="footer-top section-wrap">
        <div>
          <Link className="wordmark" href="/">
            naty<span>.</span>studio
          </Link>
          <p style={{ color: "var(--muted)", fontSize: ".84rem", lineHeight: 1.7, marginTop: "1rem", maxWidth: "290px" }}>
            {footerContent.description}
          </p>
        </div>

        <div>
          <h3>Navegación</h3>
          <div className="footer-nav">
            {NAV_LINKS.map(link => (
              <Link key={link.href} href={link.href}>
                {link.label}
              </Link>
            ))}
            <Link href="/reservar">Agendar hora</Link>
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
