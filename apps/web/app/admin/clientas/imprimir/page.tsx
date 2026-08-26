"use client";

import { Loader2, Printer } from "lucide-react";
import { useSearchParams } from "next/navigation";
import { formatBusinessDate } from "@naty/shared";
import { trpc } from "@/lib/trpc";

export default function AdminCustomersPrintPage() {
  const params = useSearchParams();
  const search = params.get("search") ?? undefined;

  const { data, isLoading } = trpc.admin.customers.listAll.useQuery({ search });

  if (isLoading || !data) {
    return (
      <p style={{ color: "var(--muted)", display: "flex", gap: ".6rem", alignItems: "center" }}>
        <Loader2 size={17} className="animate-spin" /> Preparando el listado…
      </p>
    );
  }

  return (
    <>
      <div className="admin-header no-print">
        <div>
          <h1>Listado de clientas</h1>
          <p>Se abre el diálogo de impresión del navegador: ahí puedes guardarlo como PDF.</p>
        </div>
        <button type="button" className="primary-link" onClick={() => window.print()}>
          <Printer size={16} /> Descargar PDF
        </button>
      </div>

      <h1 className="print-only">Clientas · naty.studio</h1>
      <p className="print-only" style={{ marginBottom: "1rem" }}>
        Generado el {formatBusinessDate(new Date())}
      </p>

      <div className="table-scroll">
        <table className="data-table print-table">
          <thead>
            <tr>
              <th>Nombre</th>
              <th>Correo</th>
              <th>Teléfono</th>
            </tr>
          </thead>
          <tbody>
            {data.map(customer => (
              <tr key={customer.id}>
                <td>{customer.name}</td>
                <td>{customer.email}</td>
                <td>{customer.phone}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
