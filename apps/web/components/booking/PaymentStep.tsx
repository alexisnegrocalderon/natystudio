"use client";

import { Payment, initMercadoPago } from "@mercadopago/sdk-react";
import { CheckCircle2, Loader2, TriangleAlert } from "lucide-react";
import { useEffect, useState } from "react";
import { estimateServiceFee, formatClp } from "@naty/shared";
import { trpc } from "@/lib/trpc";

/** El SDK toca `window` al inicializarse: una sola vez por sesión de página. */
let mpInitialized = false;

type PaymentPlanInfo = { depositClp: number | null; fullClp: number };

function useCountdown(target: Date): { label: string; expired: boolean } {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const interval = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(interval);
  }, []);

  const remainingMs = target.getTime() - now;
  if (remainingMs <= 0) return { label: "0:00", expired: true };

  const minutes = Math.floor(remainingMs / 60_000);
  const seconds = Math.floor((remainingMs % 60_000) / 1000);
  return { label: `${minutes}:${String(seconds).padStart(2, "0")}`, expired: false };
}

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
  const { label: countdownLabel, expired } = useCountdown(holdExpiresAt);

  useEffect(() => {
    if (expired) onExpired();
  }, [expired, onExpired]);

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

  if (expired) {
    return (
      <div className="notice" data-tone="error">
        <TriangleAlert size={18} />
        <span>El tiempo para pagar esta hora se acabó. Elige otro horario para intentar de nuevo.</span>
      </div>
    );
  }

  const amountClp = kind === "deposit" ? (plan.depositClp ?? plan.fullClp) : plan.fullClp;
  // Lo que realmente se le cobra a la tarjeta: el monto de Naty + los gastos
  // por servicio (ver aviso más abajo). El backend cobra este mismo total.
  const chargeClp = amountClp + estimateServiceFee(amountClp);

  if (!config?.mercadoPagoPublicKey) {
    return (
      <p style={{ color: "var(--muted)", display: "flex", gap: ".5rem", alignItems: "center" }}>
        <Loader2 size={16} className="animate-spin" /> Cargando el pago…
      </p>
    );
  }

  return (
    <div>
      <p style={{ color: "var(--rose-pale)", fontSize: ".8rem", fontWeight: 700, marginBottom: "1rem" }}>
        Tienes {countdownLabel} para completar el pago
      </p>

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
            key={chargeClp}
            initialization={{ amount: chargeClp, payer: { email: customerEmail } }}
            customization={{
              paymentMethods: {
                creditCard: "all",
                debitCard: "all",
                mercadoPago: "all",
                prepaidCard: "all",
                maxInstallments: 1,
              },
              visual: {
                style: {
                  theme: "dark",
                  customVariables: {
                    baseColor: "#ea8dac",
                    baseColorFirstVariant: "#ff9ebd",
                    textPrimaryColor: "#f4eeeb",
                    textSecondaryColor: "#b8afb4",
                    inputBackgroundColor: "#282229",
                    formBackgroundColor: "#1c181d",
                    borderRadiusMedium: "10px",
                    errorColor: "#ff6b6b",
                  },
                },
              },
            }}
            onError={() =>
              setNotice({ tone: "error", message: "Ocurrió un problema al cargar el pago. Intenta de nuevo." })
            }
            onSubmit={async ({ formData }) => {
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
            }}
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
