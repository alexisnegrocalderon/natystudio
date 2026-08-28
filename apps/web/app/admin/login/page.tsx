"use client";

import { browserSupportsWebAuthn, startAuthentication } from "@simplewebauthn/browser";
import { AlertCircle, Fingerprint, KeyRound, Loader2, ShieldCheck } from "lucide-react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { trpc } from "@/lib/trpc";

export default function AdminLoginPage() {
  const router = useRouter();
  const utils = trpc.useUtils();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
  const [challengeId, setChallengeId] = useState<string | null>(null);
  const [faceIdSupported, setFaceIdSupported] = useState(false);
  const [faceIdError, setFaceIdError] = useState<string | null>(null);
  const [faceIdPending, setFaceIdPending] = useState(false);

  useEffect(() => {
    setFaceIdSupported(browserSupportsWebAuthn());
  }, []);

  async function finish() {
    await utils.auth.me.invalidate();
    router.push("/admin");
  }

  const login = trpc.auth.login.useMutation({
    onSuccess: async result => {
      // Con segundo factor activo la contraseña no abre sesión por sí sola:
      // devuelve un desafío que hay que resolver con el código.
      if (result.requiresTotp) setChallengeId(result.challengeId);
      else await finish();
    },
  });

  const verify = trpc.auth.verifyTotp.useMutation({ onSuccess: finish });

  const authOptions = trpc.auth.webauthnAuthenticationOptions.useMutation();
  const authVerify = trpc.auth.webauthnAuthenticationVerify.useMutation();

  async function loginWithFaceId() {
    setFaceIdError(null);
    setFaceIdPending(true);
    try {
      const { options, challengeId: newChallengeId } = await authOptions.mutateAsync();
      const response = await startAuthentication({ optionsJSON: options });
      await authVerify.mutateAsync({ challengeId: newChallengeId, response });
      await finish();
    } catch (error) {
      // El usuario cancela el prompt del sistema con bastante frecuencia — no es un error real.
      const isCancel = error instanceof Error && error.name === "NotAllowedError";
      if (!isCancel) {
        setFaceIdError(
          error instanceof Error ? error.message : "No se pudo entrar con Face ID. Usa tu contraseña.",
        );
      }
    } finally {
      setFaceIdPending(false);
    }
  }

  const pending = login.isPending || verify.isPending;
  const error = login.error ?? verify.error;

  return (
    <div className="login-shell">
      <Image
        src="/logo-black.png"
        alt="Natalia Rodríguez Studio"
        width={1519}
        height={572}
        style={{ height: "34px", width: "auto", marginBottom: "1rem" }}
      />
      <p className="eyebrow">
        <span className="eyebrow-dot" />
        Panel de administración
      </p>
      <h1 style={{ fontSize: "2rem", marginBottom: "1.6rem" }}>
        {challengeId ? (
          <>
            Verifica tu <em>identidad.</em>
          </>
        ) : (
          <>
            Inicia <em>sesión.</em>
          </>
        )}
      </h1>

      {error ? (
        <div className="notice" data-tone="error" style={{ marginBottom: "1.2rem" }}>
          <AlertCircle size={18} />
          <span>{error.message}</span>
        </div>
      ) : null}

      {challengeId ? (
        <form
          onSubmit={event => {
            event.preventDefault();
            verify.mutate({ challengeId, code });
          }}
        >
          <div className="notice" style={{ marginBottom: "1.2rem" }}>
            <ShieldCheck size={18} />
            <span>Abre tu aplicación autenticadora e ingresa el código de 6 dígitos.</span>
          </div>

          <div className="field">
            <label htmlFor="codigo">Código de verificación</label>
            <input
              id="codigo"
              value={code}
              onChange={event => setCode(event.target.value)}
              inputMode="numeric"
              autoComplete="one-time-code"
              autoFocus
              placeholder="123456"
              style={{ letterSpacing: ".3em", fontSize: "1.1rem" }}
            />
            <p style={{ fontSize: ".76rem", color: "var(--muted)", margin: 0 }}>
              También puedes usar uno de tus códigos de respaldo.
            </p>
          </div>

          <button type="submit" className="primary-link" style={{ width: "100%" }} disabled={pending}>
            {verify.isPending ? <Loader2 size={16} className="animate-spin" /> : <KeyRound size={16} />}
            Verificar y entrar
          </button>
        </form>
      ) : (
        <>
          {faceIdSupported ? (
            <>
              <button
                type="button"
                className="primary-link"
                style={{ width: "100%", marginBottom: "1.2rem" }}
                onClick={loginWithFaceId}
                disabled={faceIdPending}
              >
                {faceIdPending ? <Loader2 size={16} className="animate-spin" /> : <Fingerprint size={16} />}
                Entrar con Face ID
              </button>

              {faceIdError ? (
                <div className="notice" data-tone="error" style={{ marginBottom: "1.2rem" }}>
                  <AlertCircle size={18} />
                  <span>{faceIdError}</span>
                </div>
              ) : null}

              <div style={{ display: "flex", alignItems: "center", gap: ".7rem", margin: "0 0 1.2rem" }}>
                <span style={{ flex: 1, height: "1px", background: "var(--line)" }} />
                <span style={{ fontSize: ".76rem", color: "var(--muted)" }}>o con tu contraseña</span>
                <span style={{ flex: 1, height: "1px", background: "var(--line)" }} />
              </div>
            </>
          ) : null}

          <form
            onSubmit={event => {
              event.preventDefault();
              login.mutate({ email, password });
            }}
          >
            <div className="field">
              <label htmlFor="correo">Correo</label>
              <input
                id="correo"
                type="email"
                autoComplete="username"
                value={email}
                onChange={event => setEmail(event.target.value)}
                autoFocus
              />
            </div>

            <div className="field">
              <label htmlFor="clave">Contraseña</label>
              <input
                id="clave"
                type="password"
                autoComplete="current-password"
                value={password}
                onChange={event => setPassword(event.target.value)}
              />
            </div>

            <button type="submit" className="primary-link" style={{ width: "100%" }} disabled={pending}>
              {login.isPending ? <Loader2 size={16} className="animate-spin" /> : null}
              Entrar
            </button>
          </form>
        </>
      )}
    </div>
  );
}
