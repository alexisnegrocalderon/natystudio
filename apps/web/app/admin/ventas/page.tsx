"use client";

import { Loader2, Mail, MessageCircle, Plus, TrendingDown, TrendingUp, Trash2, Wallet } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { formatBusinessDate, formatClp } from "@naty/shared";
import { AdminSheet } from "@/components/admin/AdminSheet";
import { ContactButtons } from "@/components/admin/ContactButtons";
import { StatusPill } from "@/components/admin/StatusPill";
import { whatsappTo } from "@/lib/site";
import { trpc } from "@/lib/trpc";
import { useIsMobile } from "@/lib/useIsMobile";

/** Los mismos 5 tonos de la paleta del sitio, del más claro al más saturado. */
const CHART_COLORS = ["#FF5C89", "#FB8CAC", "#FDA8BF", "#FDC3D1", "#FFDBDB"];

const STATUS_LABELS: Record<string, string> = {
  pending_payment: "Esperando pago",
  pending_approval: "Por confirmar",
  confirmed: "Confirmada",
  cancelled: "Cancelada",
  completed: "Realizada",
  no_show: "No asistió",
};

const CATEGORY_SUGGESTIONS = ["Arriendo", "Insumos", "Marketing", "Servicios básicos", "Otro"];

type RangeKey = "month" | "quarter" | "year";

const RANGE_LABELS: Record<RangeKey, string> = {
  month: "Este mes",
  quarter: "Últimos 3 meses",
  year: "Este año",
};

/** Rango absoluto (ISO) para cada preset, en UTC — ver nota del router sobre por qué no hace falta hora de Chile acá. */
function rangeFor(key: RangeKey): { from: string; to: string } {
  const now = new Date();
  const to = now.toISOString();
  let from: Date;

  if (key === "month") {
    from = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  } else if (key === "quarter") {
    from = new Date(now.getTime() - 90 * 86_400_000);
  } else {
    from = new Date(Date.UTC(now.getUTCFullYear(), 0, 1));
  }

  return { from: from.toISOString(), to };
}

type ExpenseForm = {
  description: string;
  amountClp: string;
  category: string;
  locationId: string;
  incurredAt: string;
};

const EMPTY_EXPENSE: ExpenseForm = {
  description: "",
  amountClp: "",
  category: "",
  locationId: "",
  incurredAt: new Date().toISOString().slice(0, 10),
};

export default function AdminVentasPage() {
  const utils = trpc.useUtils();
  const [range, setRange] = useState<RangeKey>("month");
  const { from, to } = useMemo(() => rangeFor(range), [range]);

  const { data: summary, isLoading: loadingSummary } = trpc.admin.finance.summary.useQuery({ from, to });
  const { data: expenseList, isLoading: loadingExpenses } = trpc.admin.finance.listExpenses.useQuery({ from, to });
  const { data: purchases, isLoading: loadingPurchases } = trpc.admin.finance.listPurchases.useQuery({ from, to });
  const { data: locationList } = trpc.catalog.listLocations.useQuery();

  const [form, setForm] = useState<ExpenseForm>(EMPTY_EXPENSE);
  const [expenseOpen, setExpenseOpen] = useState(false);
  const mobile = useIsMobile();

  const createExpense = trpc.admin.finance.createExpense.useMutation({
    onSuccess: () => {
      toast.success("Gasto agregado.");
      setForm(EMPTY_EXPENSE);
      setExpenseOpen(false);
      void utils.admin.finance.listExpenses.invalidate();
      void utils.admin.finance.summary.invalidate();
    },
    onError: error => toast.error(error.message),
  });

  const deleteExpense = trpc.admin.finance.deleteExpense.useMutation({
    onSuccess: () => {
      toast.success("Gasto eliminado.");
      void utils.admin.finance.listExpenses.invalidate();
      void utils.admin.finance.summary.invalidate();
    },
    onError: error => toast.error(error.message),
  });

  function submitExpense() {
    const amount = Number(form.amountClp);
    if (!form.description.trim() || !amount || amount <= 0) {
      toast.error("Completa la descripción y un monto válido.");
      return;
    }

    createExpense.mutate({
      description: form.description.trim(),
      amountClp: Math.round(amount),
      category: form.category.trim() || "Otro",
      locationId: form.locationId ? Number(form.locationId) : null,
      incurredAt: new Date(`${form.incurredAt}T12:00:00`).toISOString(),
    });
  }

  const expenseForm = (
    <>
        <div className="field-row">
          <div className="field">
            <label htmlFor="gasto-descripcion">Descripción</label>
            <input
              id="gasto-descripcion"
              value={form.description}
              onChange={event => setForm({ ...form, description: event.target.value })}
              placeholder="Arriendo del local, insumos, publicidad…"
            />
          </div>
          <div className="field">
            <label htmlFor="gasto-monto">Monto (CLP)</label>
            <input
              id="gasto-monto"
              type="number"
              min={0}
              value={form.amountClp}
              onChange={event => setForm({ ...form, amountClp: event.target.value })}
            />
          </div>
        </div>

        <div className="field-row">
          <div className="field">
            <label htmlFor="gasto-categoria">Categoría</label>
            <input
              id="gasto-categoria"
              list="gasto-categorias"
              value={form.category}
              onChange={event => setForm({ ...form, category: event.target.value })}
              placeholder="Otro"
            />
            <datalist id="gasto-categorias">
              {CATEGORY_SUGGESTIONS.map(option => (
                <option key={option} value={option} />
              ))}
            </datalist>
          </div>
          <div className="field">
            <label htmlFor="gasto-fecha">Fecha</label>
            <input
              id="gasto-fecha"
              type="date"
              value={form.incurredAt}
              onChange={event => setForm({ ...form, incurredAt: event.target.value })}
              style={{ colorScheme: "light" }}
            />
          </div>
        </div>

        {locationList && locationList.length > 0 ? (
          <div className="field">
            <label htmlFor="gasto-sede">Sede (opcional)</label>
            <select
              id="gasto-sede"
              value={form.locationId}
              onChange={event => setForm({ ...form, locationId: event.target.value })}
            >
              <option value="">General, no es de una sede en particular</option>
              {locationList.map(item => (
                <option key={item.id} value={item.id}>
                  {item.name}
                </option>
              ))}
            </select>
          </div>
        ) : null}

        <div className="form-actions">
          <button type="button" className="primary-link" onClick={submitExpense} disabled={createExpense.isPending}>
            {createExpense.isPending ? <Loader2 size={16} className="animate-spin" /> : <Plus size={13} />}
            Agregar gasto
          </button>
        </div>
    </>
  );

  const appointmentsChartData = (summary?.appointmentsByStatus ?? []).map(row => ({
    label: STATUS_LABELS[row.status] ?? row.status,
    total: row.total,
  }));

  return (
    <>
      <div className="admin-header">
        <div>
          <h1>Ventas</h1>
          <p>Ingresos, gastos y ganancia neta del negocio.</p>
        </div>
        <div className="range-tabs">
          {(Object.keys(RANGE_LABELS) as RangeKey[]).map(key => (
            <button
              key={key}
              type="button"
              className="mini-button"
              data-variant={range === key ? "primary" : undefined}
              onClick={() => setRange(key)}
            >
              {RANGE_LABELS[key]}
            </button>
          ))}
        </div>
      </div>

      {loadingSummary || !summary ? (
        <p style={{ color: "var(--muted)", display: "flex", gap: ".6rem", alignItems: "center" }}>
          <Loader2 size={17} className="animate-spin" /> Cargando…
        </p>
      ) : (
        <>
          <div className="stat-grid">
            <div className="stat-card">
              <div className="stat-card-icon" data-tone="rose">
                <TrendingUp size={17} aria-hidden="true" />
              </div>
              <span>Ingresos</span>
              <strong>{formatClp(summary.incomeTotal)}</strong>
              <small>pagos recibidos en el período</small>
            </div>

            <div className="stat-card">
              <div className="stat-card-icon" data-tone="bright">
                <TrendingDown size={17} aria-hidden="true" />
              </div>
              <span>Gastos</span>
              <strong>{formatClp(summary.expenseTotal)}</strong>
              <small>registrados en el período</small>
            </div>

            <div className="stat-card">
              <div className="stat-card-icon" data-tone="lavender">
                <Wallet size={17} aria-hidden="true" />
              </div>
              <span>Ganancia neta</span>
              <strong>{formatClp(summary.netProfit)}</strong>
              <small>ingresos menos gastos</small>
            </div>
          </div>

          <section className="admin-card">
            <h2>Compras</h2>
            <p style={{ color: "var(--muted)", fontSize: ".85rem", marginTop: 0 }}>
              Pagos aprobados en el período, con los datos para escribirle directo a cada clienta.
            </p>

            {loadingPurchases ? (
              <p style={{ color: "var(--muted)", display: "flex", gap: ".6rem", alignItems: "center" }}>
                <Loader2 size={16} className="animate-spin" /> Cargando…
              </p>
            ) : !purchases || purchases.length === 0 ? (
              <p style={{ color: "var(--muted)" }}>Todavía no hay compras en este período.</p>
            ) : mobile ? (
              <div className="admin-list">
                {purchases.map(purchase => (
                  <article key={purchase.id} className="admin-item" style={{ boxShadow: "none" }}>
                    <div className="admin-item-top">
                      <div style={{ minWidth: 0 }}>
                        <div className="admin-item-title">{purchase.customerName}</div>
                        <div className="admin-item-meta">
                          {purchase.serviceName} · pagó el {formatBusinessDate(new Date(purchase.paidAt))}
                        </div>
                      </div>
                      <div className="admin-item-amount">{formatClp(purchase.netClp)}</div>
                    </div>
                    <div className="admin-item-meta" style={{ display: "flex", gap: ".5rem", alignItems: "center", flexWrap: "wrap", marginTop: ".5rem" }}>
                      <StatusPill status={purchase.appointmentStatus} /> cita el {formatBusinessDate(new Date(purchase.startsAt))}
                    </div>
                    <div className="admin-actions">
                      <ContactButtons
                        name={purchase.customerName}
                        phone={purchase.customerPhone}
                        email={purchase.customerEmail}
                        withEmail
                        message={`Hola ${purchase.customerName.split(" ")[0]}, te escribo de Natalia Rodríguez Studio por tu reserva de ${purchase.serviceName}.`}
                      />
                    </div>
                  </article>
                ))}
              </div>
            ) : (
              <div className="table-scroll" style={{ border: 0, background: "transparent" }}>
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Fecha</th>
                      <th>Clienta</th>
                      <th>Contacto</th>
                      <th>Servicio</th>
                      <th>Pagó</th>
                      <th>Cita</th>
                    </tr>
                  </thead>
                  <tbody>
                    {purchases.map(purchase => {
                      const firstName = purchase.customerName.split(" ")[0];
                      const message = `Hola ${firstName}, te escribo de Natalia Rodríguez Studio por tu reserva de ${purchase.serviceName}.`;
                      return (
                        <tr key={purchase.id}>
                          <td>{formatBusinessDate(new Date(purchase.paidAt))}</td>
                          <td>{purchase.customerName}</td>
                          <td>
                            <div style={{ display: "flex", flexDirection: "column", gap: ".35rem" }}>
                              <a href={`mailto:${purchase.customerEmail}`} style={{ display: "inline-flex", alignItems: "center", gap: ".35rem" }}>
                                <Mail size={13} aria-hidden="true" /> {purchase.customerEmail}
                              </a>
                              <a
                                href={whatsappTo(purchase.customerPhone, message)}
                                target="_blank"
                                rel="noreferrer"
                                style={{ display: "inline-flex", alignItems: "center", gap: ".35rem" }}
                              >
                                <MessageCircle size={13} aria-hidden="true" /> {purchase.customerPhone} · WhatsApp
                              </a>
                            </div>
                          </td>
                          <td>{purchase.serviceName}</td>
                          <td>{formatClp(purchase.netClp)}</td>
                          <td>
                            <StatusPill status={purchase.appointmentStatus} />
                            <br />
                            <small style={{ color: "var(--muted)" }}>{formatBusinessDate(new Date(purchase.startsAt))}</small>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </section>

          <section className="admin-card">
            <h2>Ingresos por mes</h2>
            {summary.incomeByMonth.length > 0 ? (
              <div className="chart-wrap">
                <ResponsiveContainer>
                  <LineChart data={summary.incomeByMonth}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--line)" />
                    <XAxis dataKey="month" stroke="var(--muted)" fontSize={12} />
                    <YAxis stroke="var(--muted)" fontSize={12} tickFormatter={value => formatClp(value)} width={90} />
                    <Tooltip formatter={(value: unknown) => formatClp(Number(Array.isArray(value) ? value[0] : (value ?? 0)))} />
                    <Line type="monotone" dataKey="total" stroke="#FF5C89" strokeWidth={2.5} dot={{ r: 3 }} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <p style={{ color: "var(--muted)" }}>Sin ingresos registrados en este período.</p>
            )}
          </section>

          <div className="chart-grid">
            <section className="admin-card">
              <h2>Ingresos por servicio</h2>
              {summary.incomeByService.length > 0 ? (
                <div className="chart-wrap">
                  <ResponsiveContainer>
                    <BarChart data={summary.incomeByService} layout="vertical" margin={{ left: 20 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="var(--line)" />
                      <XAxis type="number" stroke="var(--muted)" fontSize={12} tickFormatter={value => formatClp(value)} />
                      <YAxis type="category" dataKey="name" stroke="var(--muted)" fontSize={12} width={110} />
                      <Tooltip formatter={(value: unknown) => formatClp(Number(Array.isArray(value) ? value[0] : (value ?? 0)))} />
                      <Bar dataKey="total" radius={[0, 6, 6, 0]}>
                        {summary.incomeByService.map((entry, index) => (
                          <Cell key={entry.name} fill={CHART_COLORS[index % CHART_COLORS.length]} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              ) : (
                <p style={{ color: "var(--muted)" }}>Sin datos todavía.</p>
              )}
            </section>

            <section className="admin-card">
              <h2>Ingresos por sede</h2>
              {summary.incomeByLocation.length > 0 ? (
                <div className="chart-wrap">
                  <ResponsiveContainer>
                    <BarChart data={summary.incomeByLocation} layout="vertical" margin={{ left: 20 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="var(--line)" />
                      <XAxis type="number" stroke="var(--muted)" fontSize={12} tickFormatter={value => formatClp(value)} />
                      <YAxis type="category" dataKey="name" stroke="var(--muted)" fontSize={12} width={110} />
                      <Tooltip formatter={(value: unknown) => formatClp(Number(Array.isArray(value) ? value[0] : (value ?? 0)))} />
                      <Bar dataKey="total" radius={[0, 6, 6, 0]}>
                        {summary.incomeByLocation.map((entry, index) => (
                          <Cell key={entry.name} fill={CHART_COLORS[index % CHART_COLORS.length]} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              ) : (
                <p style={{ color: "var(--muted)" }}>Sin datos todavía.</p>
              )}
            </section>
          </div>

          <section className="admin-card">
            <h2>Citas realizadas vs. canceladas/no-show</h2>
            {appointmentsChartData.length > 0 ? (
              <div className="chart-wrap">
                <ResponsiveContainer>
                  <BarChart data={appointmentsChartData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--line)" />
                    <XAxis dataKey="label" stroke="var(--muted)" fontSize={12} />
                    <YAxis stroke="var(--muted)" fontSize={12} allowDecimals={false} />
                    <Tooltip />
                    <Bar dataKey="total" radius={[6, 6, 0, 0]}>
                      {appointmentsChartData.map((entry, index) => (
                        <Cell key={entry.label} fill={CHART_COLORS[index % CHART_COLORS.length]} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <p style={{ color: "var(--muted)" }}>Sin citas en este período.</p>
            )}
          </section>
        </>
      )}


      <section className="admin-card">
        <h2>Gastos</h2>

        {mobile ? (
          <div className="form-actions" style={{ marginTop: 0 }}>
            <button type="button" className="primary-link" onClick={() => setExpenseOpen(true)}>
              <Plus size={16} /> Agregar gasto
            </button>
          </div>
        ) : (
          expenseForm
        )}

        {loadingExpenses ? (
          <p style={{ color: "var(--muted)", marginTop: "1.5rem" }}>Cargando…</p>
        ) : expenseList && expenseList.length > 0 ? (
          <div className="table-scroll" style={{ marginTop: "1.5rem", border: 0, background: "transparent" }}>
            <table className="data-table">
              <thead>
                <tr>
                  <th>Fecha</th>
                  <th>Descripción</th>
                  <th>Categoría</th>
                  <th>Sede</th>
                  <th>Monto</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {expenseList.map(expense => (
                  <tr key={expense.id}>
                    <td data-label="Fecha">{formatBusinessDate(new Date(expense.incurredAt))}</td>
                    <td data-label="Detalle" style={{ color: "var(--paper)" }}>{expense.description}</td>
                    <td data-label="Categoría">{expense.category}</td>
                    <td data-label="Sede">{expense.locationName ?? "General"}</td>
                    <td data-label="Monto">{formatClp(expense.amountClp)}</td>
                    <td data-cell="actions">
                      <button
                        type="button"
                        className="mini-button"
                        data-variant="danger"
                        aria-label={`Eliminar el gasto ${expense.description}`}
                        onClick={() => {
                          if (confirm(`¿Eliminar el gasto "${expense.description}"?`)) deleteExpense.mutate({ id: expense.id });
                        }}
                      >
                        <Trash2 size={13} /> {mobile ? "Eliminar" : null}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p style={{ marginTop: "1.5rem", color: "var(--muted)", fontSize: ".85rem" }}>
            No hay gastos registrados en este período.
          </p>
        )}
      </section>

      <AdminSheet open={expenseOpen} title="Agregar gasto" onClose={() => setExpenseOpen(false)}>
        {expenseForm}
      </AdminSheet>
    </>
  );
}
