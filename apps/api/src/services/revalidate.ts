import { ENV } from "../env";

/**
 * Pide a Next.js que regenere las páginas estáticas afectadas por un cambio de
 * contenido. Si falla no se interrumpe la operación del panel: el guardado ya
 * ocurrió y las páginas se refrescarán igualmente cuando venza su ISR.
 */
export async function revalidatePaths(paths: string[]): Promise<void> {
  if (!ENV.revalidateSecret || paths.length === 0) return;

  try {
    const response = await fetch(`${ENV.siteUrl}/api/revalidate`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${ENV.revalidateSecret}`,
      },
      body: JSON.stringify({ paths }),
    });

    if (!response.ok) {
      console.warn(`[revalidate] Next.js respondió ${response.status} para ${paths.join(", ")}`);
    }
  } catch (error) {
    console.warn("[revalidate] no se pudo avisar a Next.js:", error);
  }
}
