"use client";

import { ArrowUpRight, Menu, X } from "lucide-react";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { TransitionLink } from "@/components/TransitionLink";
import { NAV_LINKS } from "@/lib/site";

export function SiteHeader() {
  const pathname = usePathname();
  const [menuOpen, setMenuOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  // El pill se vuelve más opaco al desplazarse, para que se lea bien
  // apenas el fondo detrás deja de ser el video del hero.
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  // Navegar cierra el menú móvil: sin esto queda abierto sobre la página nueva.
  useEffect(() => {
    setMenuOpen(false);
  }, [pathname]);

  const isCurrent = (href: string) =>
    pathname === href || (href !== "/" && pathname.startsWith(`${href}/`));

  return (
    <header className="site-header" data-scrolled={scrolled}>
      <div className="header-shell">
        <div className="header-inner">
          <TransitionLink className="wordmark" href="/" aria-label="Natalia Rodríguez Studio, ir al inicio">
            <Image src="/logo-black.png" alt="Natalia Rodríguez Studio" width={1519} height={572} priority />
          </TransitionLink>

          <nav className="desktop-nav" aria-label="Navegación principal">
            {NAV_LINKS.map(link => (
              <TransitionLink
                key={link.href}
                href={link.href}
                aria-current={isCurrent(link.href) ? "page" : undefined}
              >
                {link.label}
                {link.href === "/curso" && <span className="nav-badge-new">Nuevo</span>}
              </TransitionLink>
            ))}
          </nav>

          <TransitionLink className="primary-link header-cta" href="/reservar">
            Agendar hora <ArrowUpRight size={15} aria-hidden="true" />
          </TransitionLink>

          <button
            className="menu-toggle"
            type="button"
            onClick={() => setMenuOpen(open => !open)}
            aria-label={menuOpen ? "Cerrar menú" : "Abrir menú"}
            aria-expanded={menuOpen}
            aria-controls="menu-movil"
          >
            {menuOpen ? <X size={21} /> : <Menu size={21} />}
          </button>
        </div>

        <nav className="mobile-nav" id="menu-movil" data-open={menuOpen} aria-label="Navegación móvil">
          {NAV_LINKS.map(link => (
            <TransitionLink key={link.href} href={link.href} aria-current={isCurrent(link.href) ? "page" : undefined}>
              <span>
                {link.label}
                {link.href === "/curso" && <span className="nav-badge-new">Nuevo</span>}
              </span>
              <ArrowUpRight size={16} aria-hidden="true" />
            </TransitionLink>
          ))}
          <TransitionLink className="primary-link" href="/reservar">
            Agendar hora <ArrowUpRight size={16} aria-hidden="true" />
          </TransitionLink>
        </nav>
      </div>
    </header>
  );
}
