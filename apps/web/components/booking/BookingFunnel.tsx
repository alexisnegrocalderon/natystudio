"use client";

import { AnimatePresence, motion } from "framer-motion";
import {
  ArrowLeft,
  ArrowUpRight,
  CalendarCheck,
  CheckCircle2,
  Info,
  Loader2,
  MapPin,
  TriangleAlert,
} from "lucide-react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
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

const STEPS_SIN_PAGO = ["Sede", "Servicios", "Fecha y hora", "Tus datos", "Listo"] as const;
const STEPS_CON_PAGO = ["Sede", "Servicios", "Fecha y hora", "Tus datos", "Pago", "Listo"] as const;

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

function shortDate(date: Date): string {
  const day = date.toLocaleDateString("es-CL", { day: "numeric", month: "short", timeZone: "America/Santiago" });
  return `${day} · ${formatBusinessTime(date)}`;
}

export function BookingFunnel() {
  const router = useRouter();
  const params = useSearchParams();

  // El estado vive en la URL: recargar o compartir el enlace no pierde el avance.
  const locationSlug = params.get("sede");
  const serviceSlugs = useMemo(
    () => (params.get("servicios")?.split(",").filter(Boolean) ?? []),
    [params],
  );
  // "listo" separa "ya elegí servicios" de "confirmé la selección y quiero
  // avanzar" — con selección múltiple, tocar un servicio ya no basta para
  // saber que la persona terminó de elegir.
  const servicesConfirmed = params.get("listo") === "1";
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
  const { data: locationList, isLoading: loadingLocations } = trpc.catalog.listLocations.useQuery();
  const { data: services, isLoading: loadingServices } = trpc.catalog.listServices.useQuery({
    kind: "service",
  });

  const captureLead = trpc.lead.capture.useMutation();
  const createBooking = trpc.booking.create.useMutation();
  const cancelHold = trpc.booking.cancel.useMutation();

  const location = useMemo(
    () => locationList?.find(item => item.slug === locationSlug) ?? null,
    [locationList, locationSlug],
  );

  // En el orden en que se eligieron, no el orden del catálogo — así "el
  // primer servicio" (el que queda como principal en la reserva) es
  // predecible para quien reserva.
  const selectedServices = useMemo(
    () => serviceSlugs.map(slug => services?.find(item => item.slug === slug)).filter((item): item is NonNullable<typeof item> => Boolean(item)),
    [services, serviceSlugs],
  );
  const totalDurationMin = selectedServices.reduce((sum, item) => sum + item.durationMin, 0);
  const totalPriceClp = selectedServices.reduce((sum, item) => sum + item.priceClp, 0);

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
  const paymentRequired = Boolean(config?.paymentsEnabled) && selectedServices.length > 0 && totalPriceClp > 0;
  const steps = paymentRequired ? STEPS_CON_PAGO : STEPS_SIN_PAGO;

  const step = confirmation
    ? steps.length
    : hold
      ? steps.length - 1
      : !location
        ? 1
        : !(selectedServices.length > 0 && servicesConfirmed)
          ? 2
          : !selectedSlot
            ? 3
            : 4;

  // Dirección de la transición: hacia adelante desliza desde la derecha,
  // hacia atrás desde la izquierda — la sensación de "avanzar" en la
  // encuesta depende de que nunca sea el mismo movimiento en los dos
  // sentidos.
  const prevStepRef = useRef(step);
  const direction = step >= prevStepRef.current ? 1 : -1;
  useEffect(() => {
    prevStepRef.current = step;
  }, [step]);

  // Ventana máxima de reserva. Se recorta al año para no dibujar un calendario
  // infinito si la configuración fuera muy amplia.
  const maxDay = addDaysToDay(businessToday(), 365);
  const serviceIds = useMemo(() => selectedServices.map(item => item.id), [selectedServices]);

  const { data: dayAvailability } = trpc.availability.getSlots.useQuery(
    { serviceIds, locationId: location?.id ?? 0, from: selectedDay ?? "", to: selectedDay ?? "" },
    { enabled: Boolean(serviceIds.length && location && selectedDay) },
  );

  const slots = dayAvailability?.[0]?.slots ?? [];

  // Si el día elegido no alcanza para la suma de servicios, se investiga por
  // qué: ¿alcanza al menos para el primero? ¿y cuál es la fecha más cercana
  // donde sí entran todos juntos? Sólo se consulta cuando hace falta — nunca
  // en el camino feliz de "sí había hora".
  const noRoomForCombo = Boolean(selectedDay) && dayAvailability !== undefined && slots.length === 0;

  const { data: singleServiceCheck } = trpc.availability.getSlots.useQuery(
    { serviceIds: serviceIds.slice(0, 1), locationId: location?.id ?? 0, from: selectedDay ?? "", to: selectedDay ?? "" },
    { enabled: Boolean(noRoomForCombo && selectedServices.length > 1 && location && selectedDay) },
  );
  const onlyFitsOne = (singleServiceCheck?.[0]?.slots.length ?? 0) > 0;

  const nearestRangeTo = selectedDay ? addDaysToDay(selectedDay, 30) : null;
  const { data: nearestAvailability } = trpc.availability.getSlots.useQuery(
    { serviceIds, locationId: location?.id ?? 0, from: selectedDay ?? "", to: nearestRangeTo ?? "" },
    { enabled: Boolean(noRoomForCombo && location && selectedDay && nearestRangeTo) },
  );
  const nearestSlot = useMemo(() => {
    for (const day of nearestAvailability ?? []) {
      if (day.slots.length > 0) {
        return { day: day.date, startsAt: new Date(day.slots[0].startsAt).toISOString(), label: day.slots[0].label };
      }
    }
    return null;
  }, [nearestAvailability]);

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
    if (selectedServices.length === 0 || !location || !selectedSlot || !validate()) return;

    try {
      const result = await createBooking.mutateAsync({
        serviceIds,
        locationId: location.id,
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
        serviceId: selectedServices[0]?.id,
        step: "datos",
      });
    }, 800);

    return () => clearTimeout(timer);
    // captureLead se omite a propósito: su referencia cambia en cada render y
    // reiniciaría el temporizador sin necesidad.
  }, [customer.email, customer.name, customer.phone, selectedServices]);

  const slotDate = selectedSlot ? new Date(selectedSlot) : null;

  // Migas de las respuestas ya elegidas: reemplazan la tarjeta lateral de
  // resumen. Cada una, cuando ya está respondida, se puede tocar para volver
  // a ese paso — limpia esa respuesta y todas las que dependían de ella.
  const serviceCrumbLabel =
    selectedServices.length === 0
      ? "Servicios"
      : selectedServices.length === 1
        ? selectedServices[0].name
        : `${selectedServices.length} servicios`;

  const crumbs: { label: string; done: boolean; onEdit?: () => void }[] = [
    {
      label: location?.name ?? "Sede",
      done: step > 1,
      onEdit: () => setParams({ sede: null, servicios: null, listo: null, dia: null, hora: null }),
    },
    {
      label: serviceCrumbLabel,
      done: step > 2,
      onEdit: () => setParams({ listo: null, dia: null, hora: null }),
    },
    {
      label: slotDate ? shortDate(slotDate) : "Fecha y hora",
      done: step > 3,
      onEdit: () => setParams({ hora: null }),
    },
    { label: "Tus datos", done: step > 4 },
  ];

  return (
    <div className="funnel-stage">
      <nav className="funnel-crumbs" aria-label="Progreso de la reserva">
        {crumbs.map((crumb, index) => {
          const position = index + 1;
          const state = position === step ? "current" : crumb.done ? "done" : "pending";
          const clickable = crumb.done && Boolean(crumb.onEdit);
          return (
            <button
              key={crumb.label + index}
              type="button"
              className="funnel-crumb"
              data-state={state}
              disabled={!clickable}
              onClick={clickable ? crumb.onEdit : undefined}
            >
              {state === "done" ? <CheckCircle2 size={13} aria-hidden="true" /> : null}
              {crumb.label}
            </button>
          );
        })}
      </nav>

      <div className="funnel-stage-body">
        <AnimatePresence mode="wait" custom={direction}>
          <motion.div
            key={step}
            custom={direction}
            initial={{ opacity: 0, x: direction > 0 ? 36 : -36 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: direction > 0 ? -36 : 36 }}
            transition={{ duration: 0.28, ease: [0.23, 1, 0.32, 1] }}
            className="funnel-step-inner"
          >
            {/* ── Paso 1: elegir sede ─────────────────────────────────── */}
            {step === 1 ? (
              <section aria-labelledby="paso-sede">
                <h1 id="paso-sede" className="page-title" style={{ fontSize: "clamp(2rem, 4vw, 3rem)" }}>
                  ¿Dónde te gustaría atenderte?
                </h1>
                <p className="lede">Elige la sede y te mostramos los servicios y horarios disponibles ahí.</p>

                {loadingLocations ? (
                  <p style={{ color: "var(--muted)", display: "flex", gap: ".5rem", alignItems: "center" }}>
                    <Loader2 size={16} className="animate-spin" /> Cargando sedes…
                  </p>
                ) : locationList && locationList.length > 0 ? (
                  <div className="stack">
                    {locationList.map(item => (
                      <button
                        key={item.slug}
                        type="button"
                        className="choice-card"
                        aria-pressed={locationSlug === item.slug}
                        onClick={() => setParams({ sede: item.slug, servicios: null, listo: null, dia: null, hora: null })}
                      >
                        <MapPin size={20} aria-hidden="true" style={{ flex: "0 0 auto", color: "var(--rose)" }} />
                        <div>
                          <h3>{item.name}</h3>
                          <p>
                            {item.streetAddress ? `${item.streetAddress}, ` : ""}
                            {item.city}, {item.region}
                          </p>
                          {item.note ? <div className="choice-meta">{item.note}</div> : null}
                        </div>
                      </button>
                    ))}
                  </div>
                ) : (
                  <div className="notice" data-tone="warn">
                    <TriangleAlert size={18} />
                    <span>No hay sedes publicadas todavía. Escríbenos por WhatsApp y coordinamos tu hora.</span>
                  </div>
                )}
              </section>
            ) : null}

            {/* ── Paso 2: elegir servicios (selección múltiple) ───────── */}
            {step === 2 ? (
              <section aria-labelledby="paso-servicio">
                <button
                  type="button"
                  className="text-link"
                  onClick={() => setParams({ sede: null, servicios: null, listo: null, dia: null, hora: null })}
                  style={{ marginBottom: "1.4rem", background: "none", border: 0, cursor: "pointer" }}
                >
                  <ArrowLeft size={15} /> Cambiar sede
                </button>

                <h1 id="paso-servicio" className="page-title" style={{ fontSize: "clamp(2rem, 4vw, 3rem)" }}>
                  ¿Qué necesitas?
                </h1>
                <p className="lede">
                  Elige uno o más servicios — se suman la duración y el valor. Toca cada uno para
                  seleccionarlo.
                </p>

                {loadingServices ? (
                  <p style={{ color: "var(--muted)", display: "flex", gap: ".5rem", alignItems: "center" }}>
                    <Loader2 size={16} className="animate-spin" /> Cargando servicios…
                  </p>
                ) : services && services.length > 0 ? (
                  <>
                    <div className="stack">
                      {services.map(item => {
                        const selected = serviceSlugs.includes(item.slug);
                        return (
                          <button
                            key={item.slug}
                            type="button"
                            className="choice-card"
                            aria-pressed={selected}
                            onClick={() => {
                              const next = selected
                                ? serviceSlugs.filter(slug => slug !== item.slug)
                                : [...serviceSlugs, item.slug];
                              setParams({
                                servicios: next.length > 0 ? next.join(",") : null,
                                listo: null,
                                dia: null,
                                hora: null,
                              });
                            }}
                          >
                            <CheckCircle2
                              size={20}
                              aria-hidden="true"
                              className="choice-check"
                              style={{ flex: "0 0 auto" }}
                            />
                            <div>
                              <h3>{item.name}</h3>
                              <p>{item.shortDescription}</p>
                              <div className="choice-meta">
                                <span>{formatDuration(item.durationMin)}</span>
                                <span>{priceLabel(item.priceClp)}</span>
                              </div>
                            </div>
                          </button>
                        );
                      })}
                    </div>

                    {selectedServices.length > 0 ? (
                      <div className="form-actions" style={{ marginTop: "1.6rem" }}>
                        <button
                          type="button"
                          className="primary-link"
                          onClick={() => setParams({ listo: "1" })}
                        >
                          Continuar con {selectedServices.length === 1 ? "este servicio" : `estos ${selectedServices.length} servicios`}{" "}
                          <ArrowUpRight size={17} />
                        </button>
                        <span style={{ color: "var(--muted)", fontSize: ".85rem", alignSelf: "center" }}>
                          {formatDuration(totalDurationMin)} · {priceLabel(totalPriceClp)}
                        </span>
                      </div>
                    ) : null}
                  </>
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

            {/* ── Paso 3: fecha y hora ────────────────────────────────── */}
            {step === 3 && selectedServices.length > 0 && location ? (
              <section aria-labelledby="paso-fecha">
                <button
                  type="button"
                  className="text-link"
                  onClick={() => setParams({ listo: null, dia: null, hora: null })}
                  style={{ marginBottom: "1.4rem", background: "none", border: 0, cursor: "pointer" }}
                >
                  <ArrowLeft size={15} /> Cambiar servicio{selectedServices.length > 1 ? "s" : ""}
                </button>

                <h1 id="paso-fecha" className="page-title" style={{ fontSize: "clamp(2rem, 4vw, 3rem)" }}>
                  Elige tu hora
                </h1>
                <p className="lede">
                  Los días con puntos tienen horarios libres. Selecciona uno para ver las horas.
                  {selectedServices.length > 1 ? ` Buscamos ${formatDuration(totalDurationMin)} seguidos para tus ${selectedServices.length} servicios.` : ""}
                </p>

                <AvailabilityCalendar
                  serviceIds={serviceIds}
                  locationId={location.id}
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
                    <div className="notice" data-tone="warn" style={{ marginTop: "1.6rem" }}>
                      <TriangleAlert size={18} />
                      <span>
                        {onlyFitsOne
                          ? "Ese día sólo alcanza para uno de los servicios elegidos — hay algo agendado después. Prueba con menos servicios o elige otro día."
                          : "No quedan horarios ese día para tus servicios combinados. Prueba con otra fecha del calendario."}
                        {nearestSlot ? (
                          <>
                            {" "}
                            El horario más cercano donde entran todos juntos es el{" "}
                            <strong>
                              {formatBusinessDate(new Date(`${nearestSlot.day}T12:00:00Z`))} a las {nearestSlot.label}
                            </strong>
                            .{" "}
                            <button
                              type="button"
                              className="text-link"
                              style={{ background: "none", border: 0, cursor: "pointer", padding: 0 }}
                              onClick={() => setParams({ dia: nearestSlot.day, hora: nearestSlot.startsAt })}
                            >
                              Usar ese horario
                            </button>
                          </>
                        ) : null}
                      </span>
                    </div>
                  )
                ) : null}
              </section>
            ) : null}

            {/* ── Paso 4: datos de contacto ───────────────────────────── */}
            {step === 4 && selectedServices.length > 0 && location && slotDate ? (
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

            {/* ── Paso 5: pago ────────────────────────────────────────── */}
            {step === steps.length - 1 && paymentRequired && hold ? (
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

                {confirmation.amountPaidClp !== undefined && totalPriceClp > 0 ? (
                  <div className="notice" style={{ marginBottom: "1.5rem" }}>
                    <CheckCircle2 size={18} />
                    <span>
                      Pagaste {formatClp(confirmation.amountPaidClp)}.{" "}
                      {totalPriceClp - confirmation.amountPaidClp > 0
                        ? `Saldo pendiente: ${formatClp(totalPriceClp - confirmation.amountPaidClp)}, se paga en el estudio.`
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
    </div>
  );
}
