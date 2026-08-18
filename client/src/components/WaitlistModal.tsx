import { useEffect, useState } from "react";
import { CheckCircle2, X } from "lucide-react";

type ServiceOption = { slug: string; name: string };

export function WaitlistModal({ open, onOpenChange, services }: { open: boolean; onOpenChange: (open: boolean) => void; services: ServiceOption[] }) {
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [whatsapp, setWhatsapp] = useState("");
  const [serviceSlug, setServiceSlug] = useState("");
  const [consentEmail, setConsentEmail] = useState(false);
  const [status, setStatus] = useState<"idle" | "sending" | "success" | "error">("idle");
  const [error, setError] = useState("");

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => { if (event.key === "Escape") onOpenChange(false); };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open, onOpenChange]);

  if (!open) return null;

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setStatus("sending"); setError("");
    try {
      const response = await fetch("/api/waitlist", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ fullName, email, whatsapp, serviceSlug, consentEmail }) });
      const payload = await response.json() as { error?: string };
      if (!response.ok) throw new Error(payload.error || "No fue posible registrar tu interés.");
      setStatus("success");
    } catch (requestError) {
      setStatus("error"); setError(requestError instanceof Error ? requestError.message : "No fue posible registrar tu interés.");
    }
  }

  return <div className="fixed inset-0 z-[90] grid place-items-center bg-[#25101b]/45 px-4 py-6" role="presentation" onMouseDown={() => onOpenChange(false)}>
    <section role="dialog" aria-modal="true" aria-labelledby="waitlist-title" className="w-full max-w-xl rounded-[2rem] border border-white/60 bg-[#fff7fa] p-6 shadow-[0_32px_100px_rgba(39,12,26,.36)] sm:p-8" onMouseDown={(event) => event.stopPropagation()}>
      <div className="flex items-start justify-between gap-4"><div><p className="text-[10px] font-bold uppercase tracking-[.18em] text-[#a13d64]">Agenda curada</p><h2 id="waitlist-title" className="mt-2 font-serif text-3xl italic leading-none text-[#351826]">Te avisamos si se libera un cupo.</h2></div><button type="button" className="grid h-10 w-10 place-items-center rounded-full border border-[#efb7c6] text-[#7f3654]" onClick={() => onOpenChange(false)} aria-label="Cerrar lista de espera"><X size={18} /></button></div>
      {status === "success" ? <div className="mt-7 rounded-2xl bg-[#fddbe3] p-5 text-[#351826]"><CheckCircle2 className="text-[#d64275]" /><h3 className="mt-3 font-serif text-2xl italic">Estás en la lista.</h3><p className="mt-2 text-sm leading-6">Solo te contactaremos por correo si Natalia abre un cupo real compatible con tu atención. Puedes solicitar la baja cuando quieras.</p><button type="button" onClick={() => onOpenChange(false)} className="mt-5 rounded-full bg-[#351826] px-5 py-3 text-sm font-bold text-white">Entendido</button></div> : <form onSubmit={submit} className="mt-7 space-y-4"><p className="text-sm leading-6 text-[#704556]">No mostramos horas inexistentes. Si la agenda está completa, deja tus datos para recibir un aviso únicamente cuando exista disponibilidad real.</p><label className="block text-sm font-bold text-[#351826]">Nombre completo<input required value={fullName} onChange={(event) => setFullName(event.target.value)} className="mt-2 w-full rounded-xl border border-[#efb7c6] bg-white px-3 py-3 outline-none focus:border-[#ff5c89] focus:ring-2 focus:ring-[#fda8bf]" /></label><div className="grid gap-4 sm:grid-cols-2"><label className="block text-sm font-bold text-[#351826]">Correo<input required type="email" value={email} onChange={(event) => setEmail(event.target.value)} className="mt-2 w-full rounded-xl border border-[#efb7c6] bg-white px-3 py-3 outline-none focus:border-[#ff5c89] focus:ring-2 focus:ring-[#fda8bf]" /></label><label className="block text-sm font-bold text-[#351826]">WhatsApp <span className="font-normal">(opcional)</span><input value={whatsapp} onChange={(event) => setWhatsapp(event.target.value)} className="mt-2 w-full rounded-xl border border-[#efb7c6] bg-white px-3 py-3 outline-none focus:border-[#ff5c89] focus:ring-2 focus:ring-[#fda8bf]" /></label></div><label className="block text-sm font-bold text-[#351826]">Atención de interés<select value={serviceSlug} onChange={(event) => setServiceSlug(event.target.value)} className="mt-2 w-full rounded-xl border border-[#efb7c6] bg-white px-3 py-3 outline-none focus:border-[#ff5c89] focus:ring-2 focus:ring-[#fda8bf]"><option value="">Cualquier atención disponible</option>{services.map((service) => <option key={service.slug} value={service.slug}>{service.name}</option>)}</select></label><label className="flex items-start gap-3 rounded-xl bg-[#fff0f4] p-3 text-sm leading-5 text-[#5e3043]"><input required checked={consentEmail} onChange={(event) => setConsentEmail(event.target.checked)} type="checkbox" className="mt-1 h-4 w-4 accent-[#d64275]" /><span>Acepto recibir por correo un aviso si se libera un cupo real. No recibiré promociones ajenas a esta lista de espera.</span></label>{status === "error" ? <p role="alert" className="rounded-xl bg-[#ffe0e6] px-3 py-2 text-sm text-[#8e3556]">{error}</p> : null}<button disabled={status === "sending" || !consentEmail} className="w-full rounded-full bg-[#d64275] px-5 py-3 text-sm font-bold text-white transition hover:bg-[#b92d61] disabled:cursor-wait disabled:opacity-60">{status === "sending" ? "Guardando…" : "Avisarme si se libera un cupo"}</button></form>}
    </section>
  </div>;
}
