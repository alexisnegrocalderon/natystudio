import { createTRPCClient, httpBatchLink } from "@trpc/client";
import superjson from "superjson";
import type { AppRouter } from "@naty/api";

export const API_URL = (process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000").replace(/\/$/, "");

/** Cliente para componentes de servidor. Sólo consulta datos públicos. */
export const api = createTRPCClient<AppRouter>({
  links: [
    httpBatchLink({
      url: `${API_URL}/api/trpc`,
      transformer: superjson,
    }),
  ],
});

/**
 * Envuelve una consulta al API para que un fallo no tumbe la compilación.
 *
 * Las páginas públicas se generan estáticamente, así que se consultan durante
 * el build. Si el API todavía no está desplegado —el caso normal del primer
 * despliegue— el error rompería `next build` entero. Devolver el valor de
 * reserva permite publicar el sitio y que el contenido aparezca cuando el API
 * esté disponible y venza el ISR.
 */
export async function safeQuery<T>(operation: () => Promise<T>, fallback: T, label: string): Promise<T> {
  try {
    return await operation();
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.warn(`[api] "${label}" no respondió (${message}). Se usa el valor de reserva.`);
    return fallback;
  }
}

/** Cada cuántos segundos se regenera una página estática. */
export const REVALIDATE_SECONDS = 300;
