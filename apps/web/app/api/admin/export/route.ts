import { requireAdminUser } from "@naty/api/context";
import { listAllCustomers } from "@naty/api/routers/admin-customers";
import { buildCsv } from "@naty/api/services/csv";

// El driver `pg` necesita un socket TCP real, que no existe en el runtime Edge.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Exporta el listado de clientas. tRPC no devuelve binarios/archivos cómodamente. */
export async function GET(req: Request) {
  const admin = await requireAdminUser(req);
  if (!admin) {
    return Response.json({ error: "No autorizado" }, { status: 401 });
  }

  const url = new URL(req.url);
  const search = url.searchParams.get("search") ?? undefined;

  const customers = await listAllCustomers(search);
  const csv = buildCsv(
    ["Nombre", "Correo", "Teléfono"],
    customers.map(customer => [customer.name, customer.email, customer.phone]),
  );

  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": 'attachment; filename="clientas-naty-studio.csv"',
    },
  });
}
