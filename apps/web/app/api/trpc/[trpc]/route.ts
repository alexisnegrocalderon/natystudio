import { fetchRequestHandler } from "@trpc/server/adapters/fetch";
import { createContext } from "@naty/api/context";
import { appRouter } from "@naty/api";

// El driver `pg` necesita un socket TCP real, que no existe en el runtime Edge.
export const runtime = "nodejs";
// Endpoint de datos vivos: nunca se debe cachear ni prerenderizar.
export const dynamic = "force-dynamic";

function handler(req: Request) {
  return fetchRequestHandler({
    endpoint: "/api/trpc",
    req,
    router: appRouter,
    createContext,
    onError({ error, path }) {
      // El mensaje que ve el cliente oculta la causa real a propósito; queda
      // sólo en el log del servidor, donde no es sensible.
      console.error(`[trpc] ${path ?? "?"}:`, error.cause ?? error);
    },
  });
}

export { handler as GET, handler as POST };
