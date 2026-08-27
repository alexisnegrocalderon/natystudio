"use client";

import { Loader2, Plus, TrendingDown, TrendingUp, Trash2, Wallet } from "lucide-react";
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
import { trpc } from "@/lib/trpc";

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
  const { data: locationList } = trpc.catalog.listLocations.useQuery();

  const [form, setForm] = useState<ExpenseForm>(EMPTY_EXPENSE);

  const createExpense = trpc.admin.finance.createExpense.useMutation({
    onSuccess: () => {
      toast.success("Gasto agregado.");
      setForm(EMPTY_EXPENSE);
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
              <small>citas realizadas en el período</small>
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
          <button type="button" className="mini-button" data-variant="primary" onClick={submitExpense} disabled={createExpense.isPending}>
            {createExpense.isPending ? <Loader2 size={16} className="animate-spin" /> : <Plus size={13} />}
            Agregar gasto
          </button>
        </div>

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
                    <td>{formatBusinessDate(new Date(expense.incurredAt))}</td>
                    <td style={{ color: "var(--paper)" }}>{expense.description}</td>
                    <td>{expense.category}</td>
                    <td>{expense.locationName ?? "General"}</td>
                    <td>{formatClp(expense.amountClp)}</td>
                    <td>
                      <button
                        type="button"
                        className="mini-button"
                        data-variant="danger"
                        onClick={() => deleteExpense.mutate({ id: expense.id })}
                      >
                        <Trash2 size={13} />
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
    </>
  );
}
