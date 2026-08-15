"use client";

import { AlertCircle, Loader2, ShieldCheck, ShieldOff } from "lucide-react";
import Image from "next/image";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { BUSINESS_TIMEZONE } from "@naty/shared";
import { trpc } from "@/lib/trpc";

export default function AdminSettingsPage() {
  const utils = trpc.useUtils();
  const { data: user } = trpc.auth.me.useQuery();
  const { data: settings, isLoading } = trpc.admin.schedule.getSettings.useQuery();

  const [form, setForm] = useState({
    slotGranularityMin: 30,
    minLeadTimeHours: 12,
    maxAdvanceDays: 60,
    autoApprove: false,
  });

  const [enrollment, setEnrollment] = useState<{ qrDataUrl: string; secret: string } | null>(null);
  const [totpCode, setTotpCode] = useState("");
  const [backupCodes, setBackupCodes] = useState<string[] | null>(null);

  useEffect(() => {
    if (!settings) return;
    setForm({
      slotGranularityMin: settings.slotGranularityMin,
      minLeadTimeHours: settings.minLeadTimeHours,
      maxAdvanceDays: settings.maxAdvanceDays,
      autoApprove: settings.autoApprove,
    });
  }, [settings]);

  const save = trpc.admin.schedule.updateSettings.useMutation({
    onSuccess: () => {
      toast.success("Ajustes guardados.");
      void utils.admin.schedule.getSettings.invalidate();
    },
    onError: error => toast.error(error.message),
  });

  const setupTotp = trpc.auth.setupTotp.useMutation({
    onSuccess: result => setEnrollment({ qrDataUrl: result.qrDataUrl, secret: result.secret }),
    onError: error => toast.error(error.message),
  });

  const confirmTotp = trpc.auth.confirmTotp.useMutation({
    onSuccess: result => {
      setBackupCodes(result.backupCodes);
      setEnrollment(null);
      setTotpCode("");
      toast.success("Verificación en dos pasos activada.");
      void utils.auth.me.invalidate();
    },
    onError: error => toast.error(error.message),
  });

  return (
    <>
      <div className="admin-header">
        <div>
          <h1>Ajustes</h1>
          <p>Cómo funciona tu agenda y la seguridad de tu cuenta.</p>
        </div>
      </div>

      <section className="admin-card">
        <h2>Reglas de la agenda</h2>

        {isLoading ? (
          <p style={{ color: "var(--muted)", display: "flex", gap: ".6rem", alignItems: "center" }}>
            <Loader2 size={16} className="animate-spin" /> Cargando…
          </p>
        ) : (
          <>
            <div className="field-row">
              <div className="field">
                <label htmlFor="granularidad">Cada cuántos minutos ofrecer una hora</label>
                <input
                  id="granularidad"
                  type="number"
                  min={5}
                  max={120}
                  value={form.slotGranularityMin}
                  onChange={event =>
                    setForm({ ...form, slotGranularityMin: Number(event.target.value) })
                  }
                />
                <p style={{ fontSize: ".74rem", color: "var(--muted)", margin: 0 }}>
                  Con 30, las horas ofrecidas son 10:00, 10:30, 11:00…
                </p>
              </div>

              <div className="field">
                <label htmlFor="antelacion">Antelación mínima (horas)</label>
                <input
                  id="antelacion"
                  type="number"
                  min={0}
                  max={720}
                  value={form.minLeadTimeHours}
                  onChange={event => setForm({ ...form, minLeadTimeHours: Number(event.target.value) })}
                />
                <p style={{ fontSize: ".74rem", color: "var(--muted)", margin: 0 }}>
                  Nadie podrá reservar con menos aviso que este.
                </p>
              </div>
            </div>

            <div className="field">
              <label htmlFor="ventana">Hasta cuántos días adelante se puede reservar</label>
              <input
                id="ventana"
                type="number"
                min={1}
                max={365}
                value={form.maxAdvanceDays}
                onChange={event => setForm({ ...form, maxAdvanceDays: Number(event.target.value) })}
              />
            </div>

            <label style={{ display: "flex", gap: ".6rem", alignItems: "flex-start", fontSize: ".88rem" }}>
              <input
                type="checkbox"
                checked={form.autoApprove}
                onChange={event => setForm({ ...form, autoApprove: event.target.checked })}
                style={{ marginTop: ".2rem" }}
              />
              <span>
                Confirmar las reservas automáticamente
                <br />
                <small style={{ color: "var(--muted)" }}>
                  Si lo activas, la cita queda agendada sin que tengas que aprobarla y la clienta recibe
                  la confirmación de inmediato.
                </small>
              </span>
            </label>

            <p style={{ marginTop: "1.2rem", fontSize: ".78rem", color: "var(--muted)" }}>
              Zona horaria de la agenda: {BUSINESS_TIMEZONE} (se ajusta sola en los cambios de horario).
            </p>

            <div className="form-actions">
              <button type="button" className="primary-link" onClick={() => save.mutate(form)} disabled={save.isPending}>
                {save.isPending ? <Loader2 size={16} className="animate-spin" /> : null}
                Guardar ajustes
              </button>
            </div>
          </>
        )}
      </section>

      <section className="admin-card">
        <h2>Verificación en dos pasos</h2>

        {user?.totpEnabled ? (
          <div className="notice">
            <ShieldCheck size={18} />
            <span>
              Está activada. Al entrar te pediremos el código de tu aplicación autenticadora además de la
              contraseña.
            </span>
          </div>
        ) : enrollment ? (
          <>
            <p style={{ color: "var(--paper-muted)", fontSize: ".88rem", lineHeight: 1.7 }}>
              Escanea este código con Google Authenticator, Authy o la app que prefieras, y luego escribe
              el código de 6 dígitos que te muestre.
            </p>

            <Image
              src={enrollment.qrDataUrl}
              alt="Código QR para configurar la verificación en dos pasos"
              width={190}
              height={190}
              unoptimized
              style={{ background: "#fff", padding: "8px", borderRadius: "6px", margin: "1rem 0" }}
            />

            <p style={{ fontSize: ".76rem", color: "var(--muted)", wordBreak: "break-all" }}>
              ¿No puedes escanear? Ingresa esta clave manualmente: <code>{enrollment.secret}</code>
            </p>

            <div className="field" style={{ maxWidth: "220px" }}>
              <label htmlFor="totp">Código de 6 dígitos</label>
              <input
                id="totp"
                value={totpCode}
                onChange={event => setTotpCode(event.target.value)}
                inputMode="numeric"
                placeholder="123456"
                style={{ letterSpacing: ".25em" }}
              />
            </div>

            <button
              type="button"
              className="primary-link"
              disabled={confirmTotp.isPending}
              onClick={() => confirmTotp.mutate({ code: totpCode })}
            >
              {confirmTotp.isPending ? <Loader2 size={16} className="animate-spin" /> : null}
              Activar
            </button>
          </>
        ) : (
          <>
            <div className="notice" data-tone="warn" style={{ marginBottom: "1.2rem" }}>
              <ShieldOff size={18} />
              <span>
                Todavía no está activada. Con ella, aunque alguien conozca tu contraseña no podrá entrar
                al panel sin tu teléfono.
              </span>
            </div>
            <button
              type="button"
              className="primary-link"
              onClick={() => setupTotp.mutate()}
              disabled={setupTotp.isPending}
            >
              {setupTotp.isPending ? <Loader2 size={16} className="animate-spin" /> : null}
              Activar verificación en dos pasos
            </button>
          </>
        )}

        {backupCodes ? (
          <div style={{ marginTop: "1.5rem" }}>
            <div className="notice" data-tone="warn">
              <AlertCircle size={18} />
              <span>
                Guarda estos códigos de respaldo en un lugar seguro. Cada uno sirve una sola vez y{" "}
                <strong style={{ color: "var(--paper)" }}>no volverán a mostrarse</strong>. Te permiten
                entrar si pierdes el teléfono.
              </span>
            </div>
            <div className="backup-codes">
              {backupCodes.map(code => (
                <code key={code}>{code}</code>
              ))}
            </div>
          </div>
        ) : null}
      </section>
    </>
  );
}
