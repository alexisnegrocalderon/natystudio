"use client";

import { browserSupportsWebAuthn, startRegistration } from "@simplewebauthn/browser";
import {
  AlertCircle,
  CreditCard,
  Fingerprint,
  Loader2,
  ShieldCheck,
  ShieldOff,
  Trash2,
  TriangleAlert,
  Unlink,
} from "lucide-react";
import Image from "next/image";
import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { BUSINESS_TIMEZONE, formatBusinessDate } from "@naty/shared";
import { trpc } from "@/lib/trpc";

export default function AdminSettingsPage() {
  const utils = trpc.useUtils();
  const searchParams = useSearchParams();
  const { data: user } = trpc.auth.me.useQuery();
  const { data: settings, isLoading } = trpc.admin.schedule.getSettings.useQuery();
  const { data: mpStatus } = trpc.admin.mercadopago.status.useQuery();

  useEffect(() => {
    const mp = searchParams.get("mp");
    if (mp === "connected") toast.success("Cuenta de Mercado Pago conectada.");
    if (mp === "error") toast.error("No se pudo conectar la cuenta de Mercado Pago. Intenta de nuevo.");
    if (mp) {
      void utils.admin.mercadopago.status.invalidate();
      window.history.replaceState(null, "", "/admin/ajustes");
    }
  }, [searchParams, utils]);

  const disconnectMp = trpc.admin.mercadopago.disconnect.useMutation({
    onSuccess: () => {
      toast.success("Cuenta de Mercado Pago desconectada.");
      void utils.admin.mercadopago.status.invalidate();
    },
    onError: error => toast.error(error.message),
  });

  const [form, setForm] = useState({
    slotGranularityMin: 30,
    minLeadTimeHours: 12,
    maxAdvanceDays: 60,
    autoApprove: false,
  });

  const [enrollment, setEnrollment] = useState<{ qrDataUrl: string; secret: string } | null>(null);
  const [totpCode, setTotpCode] = useState("");
  const [backupCodes, setBackupCodes] = useState<string[] | null>(null);

  const [faceIdSupported, setFaceIdSupported] = useState(false);
  const [faceIdPending, setFaceIdPending] = useState(false);
  const [deviceName, setDeviceName] = useState("");
  useEffect(() => {
    setFaceIdSupported(browserSupportsWebAuthn());
  }, []);

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

  const { data: credentials } = trpc.auth.webauthnCredentials.useQuery();
  const regOptions = trpc.auth.webauthnRegistrationOptions.useMutation();
  const regVerify = trpc.auth.webauthnRegistrationVerify.useMutation({
    onSuccess: () => {
      toast.success("Face ID / Touch ID activado en este dispositivo.");
      setDeviceName("");
      void utils.auth.webauthnCredentials.invalidate();
    },
    onError: error => toast.error(error.message),
  });
  const removeCredential = trpc.auth.webauthnRemoveCredential.useMutation({
    onSuccess: () => {
      toast.success("Dispositivo eliminado.");
      void utils.auth.webauthnCredentials.invalidate();
    },
    onError: error => toast.error(error.message),
  });

  async function registerFaceId() {
    setFaceIdPending(true);
    try {
      const options = await regOptions.mutateAsync();
      const response = await startRegistration({ optionsJSON: options });
      await regVerify.mutateAsync({ response, name: deviceName.trim() || "Dispositivo" });
    } catch (error) {
      const isCancel = error instanceof Error && error.name === "NotAllowedError";
      if (!isCancel) toast.error(error instanceof Error ? error.message : "No se pudo activar Face ID.");
    } finally {
      setFaceIdPending(false);
    }
  }

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
        <h2>Pagos</h2>

        {!mpStatus?.configured ? (
          <div className="notice" data-tone="warn">
            <TriangleAlert size={18} />
            <span>La conexión con Mercado Pago todavía no está configurada del lado técnico.</span>
          </div>
        ) : mpStatus.connected ? (
          <>
            <div className="notice">
              <ShieldCheck size={18} />
              <span>
                Cuenta conectada{mpStatus.email ? `: ${mpStatus.email}` : ""}
                {mpStatus.connectedAt ? ` · desde ${formatBusinessDate(new Date(mpStatus.connectedAt))}` : ""}
              </span>
            </div>
            <p style={{ fontSize: ".82rem", color: "var(--muted)", lineHeight: 1.7 }}>
              Los pagos en línea entran directo a tu cuenta. La plataforma se queda con su comisión
              automáticamente, sin que tengas que hacer nada.
            </p>
            <button
              type="button"
              className="mini-button"
              onClick={() => disconnectMp.mutate()}
              disabled={disconnectMp.isPending}
            >
              {disconnectMp.isPending ? <Loader2 size={13} className="animate-spin" /> : <Unlink size={13} />}
              Desconectar
            </button>
          </>
        ) : (
          <>
            <p style={{ fontSize: ".88rem", color: "var(--paper-muted)", lineHeight: 1.7 }}>
              Conecta tu cuenta de Mercado Pago para cobrar en línea desde{" "}
              <code>/reservar</code>. El precio de tus servicios te llega completo — a la clienta se le
              suma aparte un cargo por gastos de servicio.
            </p>
            <a href="/api/admin/mercadopago/connect" className="primary-link">
              <CreditCard size={16} />
              Conectar Mercado Pago
            </a>
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

      <section className="admin-card">
        <h2>Face ID / Touch ID</h2>
        <p style={{ color: "var(--paper-muted)", fontSize: ".88rem", lineHeight: 1.7 }}>
          Un atajo adicional para entrar más rápido desde este dispositivo, sin escribir la contraseña. La
          contraseña sigue funcionando siempre, en cualquier equipo — esto sólo agrega una opción más rápida
          en los que actives.
        </p>

        {!faceIdSupported ? (
          <div className="notice" data-tone="warn">
            <TriangleAlert size={18} />
            <span>Este navegador o dispositivo no ofrece Face ID/Touch ID.</span>
          </div>
        ) : (
          <div className="field-row" style={{ alignItems: "flex-end", flexWrap: "wrap" }}>
            <div className="field" style={{ maxWidth: "260px" }}>
              <label htmlFor="deviceName">Nombre del dispositivo</label>
              <input
                id="deviceName"
                value={deviceName}
                onChange={event => setDeviceName(event.target.value)}
                placeholder="iPhone de Naty"
              />
            </div>
            <button type="button" className="primary-link" onClick={registerFaceId} disabled={faceIdPending}>
              {faceIdPending ? <Loader2 size={16} className="animate-spin" /> : <Fingerprint size={16} />}
              Activar en este dispositivo
            </button>
          </div>
        )}

        {credentials?.length ? (
          <div className="table-scroll" style={{ marginTop: "1.2rem" }}>
            <table className="data-table">
              <thead>
                <tr>
                  <th>Dispositivo</th>
                  <th>Agregado</th>
                  <th>Último uso</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {credentials.map(credential => (
                  <tr key={credential.id}>
                    <td>{credential.name}</td>
                    <td>{formatBusinessDate(credential.createdAt)}</td>
                    <td>{credential.lastUsedAt ? formatBusinessDate(credential.lastUsedAt) : "—"}</td>
                    <td>
                      <button
                        type="button"
                        className="mini-button"
                        onClick={() => removeCredential.mutate({ id: credential.id })}
                        disabled={removeCredential.isPending}
                      >
                        <Trash2 size={14} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : null}
      </section>
    </>
  );
}
