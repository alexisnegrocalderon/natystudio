import { appRouter } from "@naty/api";

/**
 * Cliente para componentes de servidor: invoca el router de tRPC directamente
 * en el mismo proceso, sin pasar por HTTP.
 *
 * Es más que una optimización — es lo que hace posible generar las páginas
 * estáticas: durante `next build` no hay ningún servidor escuchando todavía,
 * así que una URL (incluso relativa) no tendría a quién resolverse. Una
 * llamada directa a la función del router no depende de que exista un
 * servidor: sólo necesita la base de datos.
 *
 * Todo lo que se sirve desde aquí es público (catálogo, disponibilidad,
 * contenido del blog): no hay sesión de usuario que propagar.
 */
export const api = appRouter.createCaller({
  req: new Request("http://localhost/"),
  resHeaders: new Headers(),
  user: null,
});

/**
 * Envuelve una consulta al API para que un fallo no tumbe la compilación.
 *
 * Si la base de datos no está disponible durante el build (primer despliegue,
 * variable de entorno mal configurada), el error rompería `next build`
 * entero. Devolver el valor de reserva permite publicar el sitio igual, y el
 * contenido real aparece en cuanto la base responda y venza el ISR.
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
