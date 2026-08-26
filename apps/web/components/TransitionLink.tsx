"use client";

import Link, { type LinkProps } from "next/link";
import { useRouter } from "next/navigation";
import type { AnchorHTMLAttributes, ReactNode } from "react";

type Props = LinkProps &
  Omit<AnchorHTMLAttributes<HTMLAnchorElement>, keyof LinkProps> & {
    children: ReactNode;
  };

/**
 * Link normal, salvo que envuelve la navegación en la View Transitions API
 * nativa del navegador (sin librería) para que cambiar de página se sienta
 * como un fundido, no un salto brusco. Si el navegador no la soporta (o el
 * usuario prefiere menos movimiento), cae de vuelta a un <Link> común — la
 * navegación nunca depende de que esto funcione.
 */
export function TransitionLink({ href, children, onClick, ...props }: Props) {
  const router = useRouter();

  const handleClick = (event: React.MouseEvent<HTMLAnchorElement>) => {
    onClick?.(event);
    if (event.defaultPrevented) return;
    // Los mismos casos que next/link deja pasar sin interceptar (nueva
    // pestaña, click con modificador, etc.).
    if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;

    const supportsViewTransitions = typeof document.startViewTransition === "function";
    const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (!supportsViewTransitions || prefersReducedMotion) return;

    event.preventDefault();
    try {
      document.startViewTransition(() => {
        router.push(href.toString());
      });
    } catch {
      // El navegador soporta la API pero, por ejemplo, ya hay una transición
      // en curso (clicks muy seguidos): la navegación no puede depender de
      // que esto no falle nunca.
      router.push(href.toString());
    }
  };

  return (
    <Link href={href} onClick={handleClick} {...props}>
      {children}
    </Link>
  );
}
