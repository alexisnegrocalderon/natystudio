"use client";

import { usePathname } from "next/navigation";
import { useEffect } from "react";

/**
 * Motor de las animaciones "reveal-up": en vez de animar apenas se monta el
 * elemento (lo que sólo se nota arriba de la página), observa cada
 * `.reveal-up` y le agrega `.is-visible` recién cuando entra en pantalla al
 * scrollear. Sin JS o sin soporte de IntersectionObserver, el contenido
 * queda visible igual (ver la clase `reveal-ready` en globals.css) — nunca
 * depende de esto para que algo se pueda leer.
 */
export function ScrollReveal() {
  const pathname = usePathname();

  useEffect(() => {
    document.documentElement.classList.add("reveal-ready");
  }, []);

  useEffect(() => {
    const elements = Array.from(document.querySelectorAll<HTMLElement>(".reveal-up"));
    const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    if (prefersReducedMotion || !("IntersectionObserver" in window)) {
      elements.forEach(el => el.classList.add("is-visible"));
      return;
    }

    const observer = new IntersectionObserver(
      entries => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue;
          entry.target.classList.add("is-visible");
          observer.unobserve(entry.target);
        }
      },
      { threshold: 0.15, rootMargin: "0px 0px -10% 0px" },
    );

    elements.forEach(el => observer.observe(el));
    return () => observer.disconnect();
  }, [pathname]);

  return null;
}
