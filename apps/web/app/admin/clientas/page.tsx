"use client";

import { Loader2, Search, Users } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";
import { formatBusinessDate, formatClp } from "@naty/shared";
import { trpc } from "@/lib/trpc";

export default function AdminCustomersPage() {
  const [search, setSearch] = useState("");
  const [debounced, setDebounced] = useState("");

  useEffect(() => {
    const timer = setTimeout(() => setDebounced(search.trim()), 300);
    return () => clearTimeout(timer);
  }, [search]);

  const { data, isLoading, isFetching } = trpc.admin.customers.list.useQuery({
    search: debounced || undefined,
    limit: 50,
  });

  return (
    <>
      <div className="admin-header">
        <div>
          <h1>Clientas</h1>
          <p>Todas las personas que reservaron o dejaron sus datos.</p>
        </div>
      </div>

      <div className="field" style={{ maxWidth: "360px", marginBottom: "1.5rem" }}>
        <label htmlFor="buscar">
          <Search size={13} style={{ display: "inline", marginRight: ".3rem" }} />
          Buscar por nombre, correo o teléfono
        </label>
        <input
          id="buscar"
          value={search}
          onChange={event => setSearch(event.target.value)}
          placeholder="Ej: María, maria@mail.com, +56 9…"
        />
      </div>

      {isLoading ? (
        <p style={{ color: "var(--muted)", display: "flex", gap: ".6rem", alignItems: "center" }}>
          <Loader2 size={17} className="animate-spin" /> Cargando clientas…
        </p>
      ) : !data || data.items.length === 0 ? (
        <div className="empty-slots">
          <Users size={18} style={{ marginBottom: ".4rem" }} />
          <br />
          {debounced ? "No hay clientas que coincidan con la búsqueda." : "Todavía no hay clientas registradas."}
        </div>
      ) : (
        <div className="table-scroll" style={{ opacity: isFetching ? 0.6 : 1 }}>
          <table className="data-table">
            <thead>
              <tr>
                <th>Nombre</th>
                <th>Contacto</th>
                <th>Citas</th>
                <th>Última visita</th>
                <th>Total pagado</th>
              </tr>
            </thead>
            <tbody>
              {data.items.map(customer => (
                <tr key={customer.id}>
                  <td style={{ color: "var(--paper)" }}>
                    <Link href={`/admin/clientas/${customer.id}`}>{customer.name}</Link>
                  </td>
                  <td>
                    {customer.email}
                    <br />
                    <span style={{ color: "var(--muted)" }}>{customer.phone}</span>
                  </td>
                  <td>{customer.appointmentCount}</td>
                  <td>
                    {customer.lastVisit ? formatBusinessDate(new Date(customer.lastVisit)) : "—"}
                  </td>
                  <td>{formatClp(customer.totalPaidClp)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
