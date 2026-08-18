import { useEffect } from "react";

export type NatyPaymentConfig = {
  publicKey: string;
  environment: "sandbox" | "production";
  marketplace: true;
  amountClp: number;
  title: string;
};

type PaymentOutcome = { paymentId: string; paymentStatus: string; paymentStatusDetail: string | null; bookingStatus: string };

function loadMercadoPagoSdk() {
  if ((window as any).MercadoPago) return Promise.resolve();
  return new Promise<void>((resolve, reject) => {
    const current = document.querySelector<HTMLScriptElement>('script[data-naty-mercadopago="true"]');
    if (current) {
      current.addEventListener("load", () => resolve(), { once: true });
      current.addEventListener("error", () => reject(new Error("No fue posible cargar el formulario de pago.")), { once: true });
      return;
    }
    const script = document.createElement("script");
    script.src = "https://sdk.mercadopago.com/js/v2";
    script.async = true;
    script.dataset.natyMercadopago = "true";
    script.onload = () => resolve();
    script.onerror = () => reject(new Error("No fue posible cargar el formulario de pago."));
    document.head.appendChild(script);
  });
}

async function submitPayment(bookingId: number, customerEmail: string, formData: any) {
  const response = await fetch("/api/bookings/payment", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      bookingId,
      idempotencyKey: crypto.randomUUID(),
      token: formData.token,
      installments: Number(formData.installments ?? 1),
      paymentMethodId: formData.payment_method_id ?? formData.paymentMethodId,
      issuerId: formData.issuer_id ?? formData.issuerId,
      payer: { email: formData.payer?.email ?? customerEmail, identification: formData.payer?.identification },
    }),
  });
  const payload = await response.json() as { payment?: PaymentOutcome; error?: string };
  if (!response.ok || !payload.payment) throw new Error(payload.error ?? "No fue posible procesar el pago.");
  return payload.payment;
}

export function MercadoPagoPaymentBrick({ bookingId, customerEmail, config, onResult, onError }: { bookingId: number; customerEmail: string; config: NatyPaymentConfig; onResult: (result: PaymentOutcome) => void; onError: (message: string) => void }) {
  useEffect(() => {
    let active = true;
    let controller: { unmount?: () => void } | null = null;
    const mount = async () => {
      try {
        await loadMercadoPagoSdk();
        if (!active) return;
        const mercadoPago = new (window as any).MercadoPago(config.publicKey, { locale: "es-CL" });
        controller = await mercadoPago.bricks().create("payment", "naty-payment-brick", {
          initialization: { amount: config.amountClp, payer: { email: customerEmail } },
          customization: { visual: { style: { theme: "default" } }, paymentMethods: { creditCard: "all", debitCard: "all", mercadoPago: "all" } },
          callbacks: {
            onSubmit: ({ formData }: { formData: any }) => new Promise<void>((resolve, reject) => {
              submitPayment(bookingId, customerEmail, formData).then((payment) => {
                if (payment.paymentStatus === "approved") { onResult(payment); resolve(); return; }
                const detail = payment.paymentStatusDetail ? ` (${payment.paymentStatusDetail})` : "";
                const error = `El pago no fue aprobado todavía${detail}. Puedes revisar los datos e intentarlo nuevamente.`;
                onError(error);
                reject(new Error(error));
              }).catch((error) => {
                const message = error instanceof Error ? error.message : "No fue posible procesar el pago.";
                onError(message);
                reject(error);
              });
            }),
            onError: (error: unknown) => onError(error instanceof Error ? error.message : "El formulario de pago no está disponible."),
          },
        });
      } catch (error) {
        onError(error instanceof Error ? error.message : "No fue posible preparar el pago.");
      }
    };
    mount();
    return () => { active = false; controller?.unmount?.(); };
  }, [bookingId, config, customerEmail, onError, onResult]);

  return <div id="naty-payment-brick" className="mt-4 min-h-32 rounded-xl border border-[#EFB7C6] bg-white p-2" />;
}
