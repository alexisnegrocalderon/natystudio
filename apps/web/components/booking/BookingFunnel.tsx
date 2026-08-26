"use client";

import { AnimatePresence, motion } from "framer-motion";
import {
  ArrowLeft,
  ArrowUpRight,
  CalendarCheck,
  CheckCircle2,
  Info,
  Loader2,
  TriangleAlert,
} from "lucide-react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  customerInputSchema,
  formatBusinessDate,
  formatBusinessTime,
  formatClp,
  formatDuration,
} from "@naty/shared";
import { AvailabilityCalendar } from "@/components/booking/AvailabilityCalendar";
import { addDaysToDay, businessToday, toBusinessDay } from "@/lib/dates";
import { trpc } from "@/lib/trpc";

// El SDK de Mercado Pago toca `window` al inicializarse: nunca debe formar
// parte del render del servidor.
const PaymentStep = dynamic(
  () => import("@/components/booking/PaymentStep").then(module => module.PaymentStep),
  {
    ssr: false,
    loading: () => (
      <p style={{ color: "var(--muted)", display: "flex", gap: ".5rem", alignItems: "center" }}>
        <Loader2 size={16} className="animate-spin" /> Cargando el pago…
      </p>
    ),
  },
);

const STEPS_SIN_PAGO = ["Servicio", "Fecha y hora", "Tus datos", "Listo"] as const;
const STEPS_CON_PAGO = ["Servicio", "Fecha y hora", "Tus datos", "Pago", "Listo"] as const;

type Hold = {
  publicId: string;
  cancelToken: string;
  depositClp: number | null;
  fullClp: number;
  holdExpiresAt: Date;
};

type CustomerFields = { name: string; email: string; phone: string; notes: string };

const EMPTY_CUSTOMER: CustomerFields = { name: "", email: "", phone: "", notes: "" };

/** Un precio en cero significa "por confirmar", no gratuito. */
function priceLabel(priceClp: number): string {
  return priceClp > 0 ? formatClp(priceClp) : "Por confirmar";
}

export function BookingFunnel() {
  const router = useRouter();
  const params = useSearchParams();

  // El estado vive en la URL: recargar o compartir el enlace no pierde el avance.
  const serviceSlug = params.get("servicio");
  const selectedDay = params.get("dia");
  const selectedSlot = params.get("hora");

  const [customer, setCustomer] = useState<CustomerFields>(EMPTY_CUSTOMER);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [confirmation, setConfirmation] = useState<{
    publicId: string;
    status: string;
    amountPaidClp?: number;
  } | null>(null);
  const [hold, setHold] = useState<Hold | null>(null);

  const { data: config } = trpc.config.useQuery();
  const { data: services, isLoading: loadingServices } = trpc.catalog.listServices.useQuery({
    kind: "service",
  });

  const captureLead = trpc.lead.capture.useMutation();
  const createBooking = trpc.booking.create.useMutation();
  const cancelHold = trpc.booking.cancel.useMutation();

  const service = useMemo(
    () => services?.find(item => item.slug === serviceSlug) ?? null,
    [services, serviceSlug],
  );

  const setParams = useCallback(
    (next: Record<string, string | null>) => {
      const search = new URLSearchParams(params.toString());
      for (const [key, value] of Object.entries(next)) {
        if (value === null) search.delete(key);
        else search.set(key, value);
      }
      router.replace(`/reservar?${search.toString()}`, { scroll: false });
    },
    [params, router],
  );

  // Se anticipa del lado del cliente si esta reserva pasará por el paso de
  // pago (mismo criterio que `resolvePaymentPlan` en el servidor), para que
  // la barra de progreso muestre la cantidad correcta de pasos desde el
  // principio, no recién después de crear la reserva.
  const paymentRequired = Boolean(config?.paymentsEnabled) && Boolean(service) && (service?.priceClp ?? 0) > 0;
  const steps = paymentRequired ? STEPS_CON_PAGO : STEPS_SIN_PAGO;

  const step = confirmation ? steps.length : hold ? steps.length - 1 : !service ? 1 : !selectedSlot ? 2 : 3;

  // Ventana máxima de reserva. Se recorta al año para no dibujar un calendario
  // infinito si la configuración fuera muy amplia.
  const maxDay = addDaysToDay(businessToday(), 365);

  const { data: dayAvailability } = trpc.availability.getSlots.useQuery(
    { serviceId: service?.id ?? 0, from: selectedDay ?? "", to: selectedDay ?? "" },
    { enabled: Boolean(service && selectedDay) },
  );

  const slots = dayAvailability?.[0]?.slots ?? [];

  // Si el horario elegido deja de estar disponible mientras la clienta completa
  // sus datos, se limpia la selección en vez de dejarla enviar una reserva que
  // el servidor va a rechazar.
  useEffect(() => {
    if (!selectedSlot || !selectedDay || !dayAvailability) return;
    const stillFree = slots.some(slot => new Date(slot.startsAt).toISOString() === selectedSlot);
    if (!stillFree) setParams({ hora: null });
  }, [dayAvailability, selectedSlot, selectedDay, slots, setParams]);

  function validate(): boolean {
    const result = customerInputSchema.safeParse({
      name: customer.name,
      email: customer.email,
      phone: customer.phone,
      notes: customer.notes || undefined,
    });

    if (result.success) {
      setErrors({});
      return true;
    }

    const found: Record<string, string> = {};
    for (const issue of result.error.issues) {
      const key = String(issue.path[0]);
      found[key] ??= issue.message;
    }
    setErrors(found);
    return false;
  }

  async function submit() {
    if (!service || !selectedSlot || !validate()) return;

    try {
      const result = await createBooking.mutateAsync({
        serviceId: service.id,
        startsAt: selectedSlot,
        customer: {
          name: customer.name,
          email: customer.email,
          phone: customer.phone,
          notes: customer.notes || undefined,
        },
      });

      if (result.payment) {
        // La reserva quedó retenida esperando pago: el paso siguiente es
        // pagar, no la confirmación final.
        setHold({
          publicId: result.publicId,
          cancelToken: result.cancelToken,
          depositClp: result.payment.depositClp,
          fullClp: result.payment.fullClp,
          holdExpiresAt: result.payment.holdExpiresAt,
        });
      } else {
        setConfirmation({ publicId: result.publicId, status: result.status });
      }
    } catch {
      // El error se muestra desde createBooking.error, más abajo.
    }
  }

  /**
   * Guarda el contacto apenas hay un correo válido, aunque la persona
   * abandone antes de reservar. Con *debounce* para no mandar una petición
   * por cada tecla mientras escribe el nombre o el teléfono.
   */
  useEffect(() => {
    const email = customer.email.trim();
    if (!email.includes("@")) return;

    const timer = setTimeout(() => {
      captureLead.mutate({
        email,
        name: customer.name || undefined,
        phone: customer.phone || undefined,
        serviceId: service?.id,
        step: "datos",
      });
    }, 800);

    return () => clearTimeout(timer);
    // captureLead se omite a propósito: su referencia cambia en cada render y
    // reiniciaría el temporizador sin necesidad.
  }, [customer.email, customer.name, customer.phone, service?.id]);

  const slotDate = selectedSlot ? new Date(selectedSlot) : null;

  return (
    <div className="funnel-shell section-wrap">
      <div>
        <nav className="step-track" aria-label="Progreso de la reserva">
          {steps.map((label, index) => {
            const position = index + 1;
            const state = position === step ? "current" : position < step ? "done" : "pending";
            return (
              <div key={label} style={{ display: "contents" }}>
                {index > 0 ? <hr /> : null}
                <span
                  className="step-dot"
                  data-state={state}
                  aria-current={state === "current" ? "step" : undefined}
                >
                  <i>{state === "done" ? "✓" : position}</i>
                  <span>{label}</span>
                </span>
              </div>
            );
          })}
        </nav>

        <AnimatePresence mode="wait">
          <motion.div
            key={step}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.25, ease: [0.23, 1, 0.32, 1] }}
          >
            {/* ── Paso 1: elegir servicio ─────────────────────────────── */}
            {step === 1 ? (
              <section aria-labelledby="paso-servicio">
                <h1 id="paso-servicio" className="page-title" style={{ fontSize: "clamp(2rem, 4vw, 3rem)" }}>
                  ¿Qué necesitas?
                </h1>
                <p className="lede">Elige el servicio y luego te mostramos las horas disponibles.</p>

                {loadingServices ? (
                  <p style={{ color: "var(--muted)", display: "flex", gap: ".5rem", alignItems: "center" }}>
                    <Loader2 size={16} className="animate-spin" /> Cargando servicios…
                  </p>
                ) : services && services.length > 0 ? (
                  <div className="stack">
                    {services.map(item => (
                      <button
                        key={item.slug}
                        type="button"
                        className="choice-card"
                        aria-pressed={serviceSlug === item.slug}
                        onClick={() => setParams({ servicio: item.slug, dia: null, hora: null })}
                      >
                        <div>
                          <h3>{item.name}</h3>
                          <p>{item.shortDescription}</p>
                          <div className="choice-meta">
                            <span>{formatDuration(item.durationMin)}</span>
                            <span>{priceLabel(item.priceClp)}</span>
                          </div>
                        </div>
                      </button>
                    ))}
                  </div>
                ) : (
                  <div className="notice" data-tone="warn">
                    <TriangleAlert size={18} />
                    <span>
                      No hay servicios publicados en este momento. Escríbenos por WhatsApp y coordinamos
                      tu hora directamente.
                    </span>
                  </div>
                )}
              </section>
            ) : null}

            {/* ── Paso 2: fecha y hora ────────────────────────────────── */}
            {step === 2 && service ? (
              <section aria-labelledby="paso-fecha">
                <button
                  type="button"
                  className="text-link"
                  onClick={() => setParams({ servicio: null, dia: null, hora: null })}
                  style={{ marginBottom: "1.4rem", background: "none", border: 0, cursor: "pointer" }}
                >
                  <ArrowLeft size={15} /> Cambiar servicio
                </button>

                <h1 id="paso-fecha" className="page-title" style={{ fontSize: "clamp(2rem, 4vw, 3rem)" }}>
                  Elige tu hora
                </h1>
                <p className="lede">
                  Los días con puntos tienen horarios libres. Selecciona uno para ver las horas.
                </p>

                <AvailabilityCalendar
                  serviceId={service.id}
                  selectedDay={selectedDay}
                  maxDay={maxDay}
                  onSelectDay={day => setParams({ dia: day, hora: null })}
                />

                {selectedDay ? (
                  slots.length > 0 ? (
                    <>
                      <p
                        style={{
                          marginTop: "2rem",
                          marginBottom: 0,
                          fontSize: ".8rem",
                          color: "var(--rose-pale)",
                          fontWeight: 700,
                          letterSpacing: ".08em",
                          textTransform: "uppercase",
                        }}
                      >
                        {formatBusinessDate(new Date(`${selectedDay}T12:00:00Z`))} ·{" "}
                        {slots.length === 1 ? "queda 1 hora" : `quedan ${slots.length} horas`}
                      </p>
                      <div className="slot-grid">
                        {slots.map(slot => {
                          const iso = new Date(slot.startsAt).toISOString();
                          return (
                            <button
                              key={iso}
                              type="button"
                              className="slot-chip"
                              aria-pressed={selectedSlot === iso}
                              onClick={() => setParams({ hora: iso })}
                            >
                              {slot.label}
                            </button>
                          );
                        })}
                      </div>
                    </>
                  ) : (
                    <div className="empty-slots" style={{ marginTop: "1.6rem" }}>
                      No quedan horarios ese día. Prueba con otra fecha del calendario.
                    </div>
                  )
                ) : null}
              </section>
            ) : null}

            {/* ── Paso 3: datos de contacto ───────────────────────────── */}
            {step === 3 && service && slotDate ? (
              <section aria-labelledby="paso-datos">
                <button
                  type="button"
                  className="text-link"
                  onClick={() => setParams({ hora: null })}
                  style={{ marginBottom: "1.4rem", background: "none", border: 0, cursor: "pointer" }}
                >
                  <ArrowLeft size={15} /> Cambiar la hora
                </button>

                <h1 id="paso-datos" className="page-title" style={{ fontSize: "clamp(2rem, 4vw, 3rem)" }}>
                  Tus datos
                </h1>
                <p className="lede">
                  Con esto confirmamos tu cita y te enviamos los detalles por correo.
                </p>

                <form
                  onSubmit={event => {
                    event.preventDefault();
                    void submit();
                  }}
                  noValidate
                >
                  <div className="field">
                    <label htmlFor="nombre">Nombre completo</label>
                    <input
                      id="nombre"
                      name="name"
                      autoComplete="name"
                      value={customer.name}
                      onChange={event => setCustomer({ ...customer, name: event.target.value })}
                      aria-invalid={Boolean(errors.name)}
                      aria-describedby={errors.name ? "error-nombre" : undefined}
                    />
                    {errors.name ? (
                      <p className="field-error" id="error-nombre">
                        {errors.name}
                      </p>
                    ) : null}
                  </div>

                  <div className="field-row">
                    <div className="field">
                      <label htmlFor="correo">Correo electrónico</label>
                      <input
                        id="correo"
                        name="email"
                        type="email"
                        autoComplete="email"
                        value={customer.email}
                        onChange={event => setCustomer({ ...customer, email: event.target.value })}
                        aria-invalid={Boolean(errors.email)}
                        aria-describedby={errors.email ? "error-correo" : undefined}
                      />
                      {errors.email ? (
                        <p className="field-error" id="error-correo">
                          {errors.email}
                        </p>
                      ) : null}
                    </div>

                    <div className="field">
                      <label htmlFor="telefono">Teléfono</label>
                      <input
                        id="telefono"
                        name="phone"
                        type="tel"
                        autoComplete="tel"
                        placeholder="+56 9 1234 5678"
                        value={customer.phone}
                        onChange={event => setCustomer({ ...customer, phone: event.target.value })}
                        aria-invalid={Boolean(errors.phone)}
                        aria-describedby={errors.phone ? "error-telefono" : undefined}
                      />
                      {errors.phone ? (
                        <p className="field-error" id="error-telefono">
                          {errors.phone}
                        </p>
                      ) : null}
                    </div>
                  </div>

                  <div className="field">
                    <label htmlFor="notas">¿Algo que debamos saber? (opcional)</label>
                    <textarea
                      id="notas"
                      name="notes"
                      value={customer.notes}
                      onChange={event => setCustomer({ ...customer, notes: event.target.value })}
                      placeholder="Cuéntanos brevemente qué te gustaría evaluar."
                    />
                  </div>

                  <div className="notice">
                    <Info size={18} />
                    <span>
                      {paymentRequired
                        ? "El siguiente paso es pagar el abono o el total para dejar tu hora asegurada."
                        : "Tu solicitud queda registrada y Naty la confirmará por correo."}
                    </span>
                  </div>

                  {createBooking.error ? (
                    <div className="notice" data-tone="error" style={{ marginTop: "1rem" }}>
                      <TriangleAlert size={18} />
                      <span>{createBooking.error.message}</span>
                    </div>
                  ) : null}

                  <div className="form-actions">
                    <button type="submit" className="primary-link" disabled={createBooking.isPending}>
                      {createBooking.isPending ? (
                        <>
                          <Loader2 size={17} className="animate-spin" /> Enviando…
                        </>
                      ) : paymentRequired ? (
                        <>
                          Continuar al pago <ArrowUpRight size={17} />
                        </>
                      ) : (
                        <>
                          Confirmar mi reserva <ArrowUpRight size={17} />
                        </>
                      )}
                    </button>
                  </div>
                </form>
              </section>
            ) : null}

            {/* ── Paso 4: pago ────────────────────────────────────────── */}
            {step === steps.length - 1 && paymentRequired && hold && service ? (
              <section aria-labelledby="paso-pago">
                <button
                  type="button"
                  className="text-link"
                  onClick={() => {
                    void cancelHold.mutateAsync({ publicId: hold.publicId, cancelToken: hold.cancelToken });
                    setHold(null);
                    setParams({ hora: null });
                  }}
                  style={{ marginBottom: "1.4rem", background: "none", border: 0, cursor: "pointer" }}
                >
                  <ArrowLeft size={15} /> Elegir otra hora
                </button>

                <h1 id="paso-pago" className="page-title" style={{ fontSize: "clamp(2rem, 4vw, 3rem)" }}>
                  Confirma tu pago
                </h1>
                <p className="lede">Elige cómo pagar para dejar tu hora asegurada.</p>

                <PaymentStep
                  publicId={hold.publicId}
                  cancelToken={hold.cancelToken}
                  plan={{ depositClp: hold.depositClp, fullClp: hold.fullClp }}
                  customerEmail={customer.email}
                  holdExpiresAt={hold.holdExpiresAt}
                  onApproved={amountPaidClp => {
                    setConfirmation({ publicId: hold.publicId, status: "confirmed", amountPaidClp });
                    setHold(null);
                  }}
                  onExpired={() => {
                    setHold(null);
                    setParams({ hora: null });
                  }}
                />
              </section>
            ) : null}

            {/* ── Paso final: confirmación ────────────────────────────── */}
            {step === steps.length && confirmation ? (
              <section aria-labelledby="paso-listo">
                <p className="eyebrow">
                  <span className="eyebrow-dot" />
                  Reserva registrada
                </p>
                <h1 id="paso-listo" className="page-title" style={{ fontSize: "clamp(2rem, 4vw, 3rem)" }}>
                  {confirmation.status === "confirmed" ? (
                    <>
                      Tu cita está <em>confirmada.</em>
                    </>
                  ) : (
                    <>
                      Recibimos tu <em>solicitud.</em>
                    </>
                  )}
                </h1>

                <div className="notice" style={{ marginBottom: "1.5rem" }}>
                  <CheckCircle2 size={18} />
                  <span>
                    {confirmation.status === "confirmed"
                      ? "Te enviamos un correo con los detalles y el archivo para agregar la cita a tu calendario."
                      : "Te enviamos un correo con el resumen. Naty revisará tu solicitud y te confirmará a la brevedad."}
                  </span>
                </div>

                {confirmation.amountPaidClp !== undefined && service ? (
                  <div className="notice" style={{ marginBottom: "1.5rem" }}>
                    <CheckCircle2 size={18} />
                    <span>
                      Pagaste {formatClp(confirmation.amountPaidClp)}.{" "}
                      {service.priceClp - confirmation.amountPaidClp > 0
                        ? `Saldo pendiente: ${formatClp(service.priceClp - confirmation.amountPaidClp)}, se paga en el estudio.`
                        : "Tu servicio quedó pagado por completo."}
                    </span>
                  </div>
                ) : null}

                <p className="lede">
                  Puedes ver el estado de tu reserva, agregarla a tu calendario o cancelarla desde su
                  página.
                </p>

                <div className="form-actions">
                  <Link className="primary-link" href={`/reserva/${confirmation.publicId}`}>
                    Ver mi reserva <ArrowUpRight size={17} />
                  </Link>
                  <Link className="ghost-link" href="/">
                    Volver al inicio
                  </Link>
                </div>
              </section>
            ) : null}
          </motion.div>
        </AnimatePresence>
      </div>

      {/* ── Resumen lateral ──────────────────────────────────────────── */}
      <aside className="funnel-summary">
        <h2>Tu reserva</h2>

        {service ? (
          <>
            <div className="summary-row">
              <span>Servicio</span>
              <strong>{service.name}</strong>
            </div>
            <div className="summary-row">
              <span>Duración</span>
              <strong>{formatDuration(service.durationMin)}</strong>
            </div>
            {slotDate ? (
              <>
                <div className="summary-row">
                  <span>Fecha</span>
                  <strong style={{ textTransform: "capitalize" }}>{formatBusinessDate(slotDate)}</strong>
                </div>
                <div className="summary-row">
                  <span>Hora</span>
                  <strong>{formatBusinessTime(slotDate)} h</strong>
                </div>
              </>
            ) : (
              <div className="summary-row">
                <span>Fecha y hora</span>
                <strong style={{ color: "var(--muted)" }}>Por elegir</strong>
              </div>
            )}

            <div className="summary-total">
              <span style={{ color: "var(--muted)", fontSize: ".8rem" }}>Valor</span>
              <strong>{priceLabel(service.priceClp)}</strong>
            </div>

            {service.depositClp > 0 ? (
              <p style={{ margin: ".8rem 0 0", fontSize: ".76rem", color: "var(--muted)", lineHeight: 1.6 }}>
                Abono para reservar: {formatClp(service.depositClp)}
              </p>
            ) : null}
          </>
        ) : (
          <p
            style={{
              margin: 0,
              color: "var(--muted)",
              fontSize: ".85rem",
              lineHeight: 1.7,
              display: "flex",
              gap: ".6rem",
            }}
          >
            <CalendarCheck size={17} style={{ flex: "0 0 auto", color: "var(--rose)" }} />
            Elige un servicio para ver el resumen de tu reserva.
          </p>
        )}
      </aside>
    </div>
  );
}
