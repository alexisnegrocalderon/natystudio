"use client";

import { Payment, initMercadoPago } from "@mercadopago/sdk-react";
import { CheckCircle2, Loader2, TriangleAlert } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { estimateServiceFee, formatClp } from "@naty/shared";
import { trpc } from "@/lib/trpc";

/** El SDK toca `window` al inicializarse: una sola vez por sesión de página. */
let mpInitialized = false;

type PaymentPlanInfo = { depositClp: number | null; fullClp: number };

type BrickFormData = {
  token: string;
  payment_method_id: string;
  issuer_id?: string;
  installments?: number;
  payer?: { email?: string };
};

/**
 * El contador vive en su propio componente: si se actualizara dentro de PaymentStep, cada segundo
 * redibujaría el paso entero y el SDK de Mercado Pago destruiría y volvería a crear el formulario de pago.
 */
function Countdown({ target, onTimeout }: { target: Date; onTimeout: () => void }) {
  const [now, setNow] = useState(() => Date.now());
  const timeoutRef = useRef(onTimeout);
  timeoutRef.current = onTimeout;

  const remainingMs = target.getTime() - now;
  const finished = remainingMs <= 0;

  useEffect(() => {
    if (finished) {
      timeoutRef.current();
      return;
    }
    const interval = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(interval);
  }, [finished]);

  const minutes = Math.max(0, Math.floor(remainingMs / 60_000));
  const seconds = Math.max(0, Math.floor((remainingMs % 60_000) / 1000));
  return (
    <p style={{ color: "var(--rose-pale)", fontSize: ".8rem", fontWeight: 700, marginBottom: "1rem" }}>
      Tienes {minutes}:{String(seconds).padStart(2, "0")} para completar el pago
    </p>
  );
}

/** Estilo del formulario de pago. Va fuera del componente para que el SDK reciba siempre el mismo objeto. */
const BRICK_CUSTOMIZATION = {
  paymentMethods: {
    creditCard: "all",
    debitCard: "all",
    mercadoPago: "all",
    prepaidCard: "all",
    maxInstallments: 1,
  },
  visual: {
    style: {
      theme: "default",
      customVariables: {
        baseColor: "#ff5c89",
        baseColorFirstVariant: "#e8447a",
        textPrimaryColor: "#3b1626",
        textSecondaryColor: "#6b4456",
        inputBackgroundColor: "#ffffff",
        formBackgroundColor: "#fff6f8",
        borderRadiusMedium: "10px",
        errorColor: "#e11d48",
      },
    },
  },
} as const;

export function PaymentStep({
  publicId,
  cancelToken,
  plan,
  customerEmail,
  holdExpiresAt,
  onApproved,
  onExpired,
}: {
  publicId: string;
  cancelToken: string;
  plan: PaymentPlanInfo;
  customerEmail: string;
  holdExpiresAt: Date;
  onApproved: (amountPaidClp: number) => void;
  onExpired: () => void;
}) {
  const { data: config } = trpc.config.useQuery();
  const [kind, setKind] = useState<"deposit" | "full">(plan.depositClp ? "deposit" : "full");
  const [notice, setNotice] = useState<{ tone: "error" | "warn"; message: string } | null>(null);
  const [waitingConfirmation, setWaitingConfirmation] = useState(false);

  const processPayment = trpc.payment.process.useMutation();
  const [expired, setExpired] = useState(false);
  const onExpiredRef = useRef(onExpired);
  onExpiredRef.current = onExpired;
  const handleTimeout = useCallback(() => {
    setExpired(true);
    onExpiredRef.current();
  }, []);

  useEffect(() => {
    if (!config?.mercadoPagoPublicKey || mpInitialized) return;
    initMercadoPago(config.mercadoPagoPublicKey, { locale: "es-CL" });
    mpInitialized = true;
  }, [config?.mercadoPagoPublicKey]);

  const { data: pollStatus } = trpc.payment.status.useQuery(
    { publicId },
    {
      enabled: waitingConfirmation,
      refetchInterval: query => (query.state.data?.appointmentStatus === "confirmed" ? false : 4000),
    },
  );

  useEffect(() => {
    if (waitingConfirmation && pollStatus?.appointmentStatus === "confirmed") {
      setWaitingConfirmation(false);
      onApproved(pollStatus.amountPaidClp);
    }
  }, [waitingConfirmation, pollStatus, onApproved]);

  const amountClp = kind === "deposit" ? (plan.depositClp ?? plan.fullClp) : plan.fullClp;
  // Lo que realmente se le cobra a la tarjeta: el monto de Naty + los gastos
  // por servicio (ver aviso más abajo). El backend cobra este mismo total.
  const chargeClp = amountClp + estimateServiceFee(amountClp);

  // El SDK recrea el formulario cuando cambia cualquiera de estas referencias, así que se mantienen
  // estables: sólo cambian si cambia el monto o el correo.
  const initialization = useMemo(
    () => ({ amount: chargeClp, payer: { email: customerEmail } }),
    [chargeClp, customerEmail],
  );
  const submitRef = useRef<(data: { formData: BrickFormData }) => Promise<void>>(async () => {});
  submitRef.current = async ({ formData }) => {
    setNotice(null);
    try {
      const response = await processPayment.mutateAsync({
        publicId,
        cancelToken,
        kind,
        formData: {
          token: formData.token,
          payment_method_id: formData.payment_method_id,
          issuer_id: formData.issuer_id,
          installments: formData.installments ?? 1,
          payer: { email: formData.payer?.email ?? customerEmail },
        },
      });

      if (response.outcome === "approved") {
        onApproved(response.amountPaidClp);
      } else if (response.outcome === "in_process") {
        setWaitingConfirmation(true);
      } else {
        setNotice({ tone: "error", message: response.message });
      }
    } catch (error) {
      setNotice({
        tone: "error",
        message: error instanceof Error ? error.message : "No se pudo procesar el pago.",
      });
    }
  };
  const handleSubmit = useCallback((data: { formData: BrickFormData }) => submitRef.current(data), []);
  const handleError = useCallback(
    () => setNotice({ tone: "error", message: "Ocurrió un problema al cargar el pago. Intenta de nuevo." }),
    [],
  );

  if (expired) {
    return (
      <div className="notice" data-tone="error">
        <TriangleAlert size={18} />
        <span>El tiempo para pagar esta hora se acabó. Elige otro horario para intentar de nuevo.</span>
      </div>
    );
  }

  if (!config?.mercadoPagoPublicKey) {
    return (
      <p style={{ color: "var(--muted)", display: "flex", gap: ".5rem", alignItems: "center" }}>
        <Loader2 size={16} className="animate-spin" /> Cargando el pago…
      </p>
    );
  }

  return (
    <div>
      <Countdown target={holdExpiresAt} onTimeout={handleTimeout} />

      {plan.depositClp ? (
        <div className="stack" style={{ marginBottom: "1.4rem" }}>
          <button
            type="button"
            className="choice-card"
            aria-pressed={kind === "deposit"}
            onClick={() => setKind("deposit")}
          >
            <div>
              <h3>Abonar para reservar</h3>
              <p>El saldo se paga en el estudio.</p>
              <div className="choice-meta">
                <span>{formatClp(plan.depositClp)}</span>
              </div>
            </div>
          </button>
          <button type="button" className="choice-card" aria-pressed={kind === "full"} onClick={() => setKind("full")}>
            <div>
              <h3>Pagar el total</h3>
              <p>Nada pendiente el día de tu cita.</p>
              <div className="choice-meta">
                <span>{formatClp(plan.fullClp)}</span>
              </div>
            </div>
          </button>
        </div>
      ) : null}

      <p style={{ color: "var(--muted)", fontSize: ".8rem", marginBottom: "1rem" }}>
        + {formatClp(chargeClp - amountClp)} de gastos por servicio (comisión de Mercado Pago y de la
        plataforma) — total a pagar: {formatClp(chargeClp)}.
      </p>

      {waitingConfirmation ? (
        <div className="notice">
          <Loader2 size={18} className="animate-spin" />
          <span>Estamos validando tu pago. Puede tardar unos segundos…</span>
        </div>
      ) : (
        <div className="payment-brick">
          <Payment
            initialization={initialization}
            customization={BRICK_CUSTOMIZATION}
            onError={handleError}
            onSubmit={handleSubmit}
          />
        </div>
      )}

      {notice ? (
        <div className="notice" data-tone={notice.tone} style={{ marginTop: "1rem" }}>
          <TriangleAlert size={18} />
          <span>{notice.message}</span>
        </div>
      ) : null}
    </div>
  );
}
