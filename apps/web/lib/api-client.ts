/**
 * URL del API para el navegador.
 *
 * Vive aparte de `api-server.ts` para que los componentes de cliente puedan
 * usar la dirección sin arrastrar el cliente tRPC de servidor al bundle.
 */
export const API_URL = (process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000").replace(/\/$/, "");
