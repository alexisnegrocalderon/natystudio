"use client";

import { useEffect, useState } from "react";

const QUERY = "(max-width: 900px)";

/**
 * true en el teléfono (mismo corte que los estilos del admin). Se lee al primer render del cliente para no
 * pintar primero la tabla de escritorio y después cambiarla por tarjetas.
 */
export function useIsMobile(): boolean {
  const [mobile, setMobile] = useState(() => typeof window !== "undefined" && window.matchMedia(QUERY).matches);
  useEffect(() => {
    const media = window.matchMedia(QUERY);
    const update = () => setMobile(media.matches);
    update();
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, []);
  return mobile;
}
