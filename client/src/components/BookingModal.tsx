import { useEffect, useMemo, useState } from "react";
import { CalendarCheck2, ChevronLeft, Clock3, LoaderCircle, ShieldCheck } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";

export type BookingService = { slug: string; name: string; description: string; priceNote: string; durationNote: string };
type Slot = { id: number; startsAt: string; endsAt: string };
type Hold = { id: number; startsAt: string; endsAt: string; holdToken: string; holdExpiresAt: string };

async function request<T>(path: string, options?: RequestInit) {
  const response = await fetch(path, { ...options, headers: { "Content-Type": "application/json", ...(options?.headers ?? {}) } });
  const payload = await response.json();
  if (!response.ok) throw new Error(payload.error ?? "No fue posible continuar con tu reserva.");
  return payload as T;
}

export function BookingModal({ open, onOpenChange, services }: { open: boolean; onOpenChange: (value: boolean) => void; services: BookingService[] }) {
  const [step, setStep] = useState<1 | 2 | 3 | 4>(1);
  const [selectedService, setSelectedService] = useState<BookingService | null>(null);
  const [slots, setSlots] = useState<Slot[]>([]);
  const [hold, setHold] = useState<Hold | null>(null);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [customer, setCustomer] = useState({ fullName: "", email: "", whatsapp: "", note: "" });
  const [bookingId, setBookingId] = useState<number | null>(null);
  const format = useMemo(() => new Intl.DateTimeFormat("es-CL", { dateStyle: "full", timeStyle: "short" }), []);

  useEffect(() => {
    if (!open) return;
    request<{ slots: Slot[] }>("/api/slots").then((data) => setSlots(data.slots)).catch((error) => setMessage(error instanceof Error ? error.message : "No fue posible cargar los horarios."));
  }, [open]);

  function close(value: boolean) {
    onOpenChange(value);
    if (!value) { setStep(1); setSelectedService(null); setHold(null); setMessage(""); setBookingId(null); }
  }
  async function chooseSlot(slot: Slot) {
    setLoading(true); setMessage("");
    try { const data = await request<{ hold: Hold }>("/api/slots/hold", { method: "POST", body: JSON.stringify({ slotId: slot.id }) }); setHold(data.hold); setStep(3); }
    catch (error) { setMessage(error instanceof Error ? error.message : "El horario ya no está disponible."); const fresh = await request<{ slots: Slot[] }>("/api/slots"); setSlots(fresh.slots); }
    finally { setLoading(false); }
  }
  async function confirmReservation(event: React.FormEvent) {
    event.preventDefault();
    if (!selectedService || !hold) return;
    setLoading(true); setMessage("");
    try {
      const data = await request<{ booking: { id: number } }>("/api/bookings", { method: "POST", body: JSON.stringify({ ...customer, serviceSlug: selectedService.slug, holdToken: hold.holdToken, idempotencyKey: crypto.randomUUID() }) });
      setBookingId(data.booking.id); setStep(4);
    } catch (error) { setMessage(error instanceof Error ? error.message : "No fue posible confirmar la reserva."); }
    finally { setLoading(false); }
  }
  const progress = ["Servicio", "Horario", "Tus datos", "Confirmación"];
  return <Dialog open={open} onOpenChange={close}><DialogContent className="max-h-[88vh] overflow-y-auto border-[#3b292d] bg-[#fbf5ef] p-0 text-[#241b1d] sm:max-w-xl" showCloseButton={false}><div className="bg-[#2b2022] px-6 py-6 text-[#f9e5e6]"><DialogHeader><DialogTitle className="font-serif text-3xl italic">Reserva tu hora</DialogTitle><DialogDescription className="mt-2 text-[#e6cfd1]">Agenda tu atención directamente en el sitio. El checkout se resolverá mediante la plataforma central de ANC; mientras se habilita en staging no se realizarán cobros.</DialogDescription></DialogHeader><div className="mt-5 grid grid-cols-4 gap-2">{progress.map((label, index) => <div key={label}><div className={`h-1 rounded-full ${step >= index + 1 ? "bg-[#f6d863]" : "bg-white/20"}`} /><span className="mt-2 block text-[10px] uppercase tracking-wide text-[#d8bec2]">{label}</span></div>)}</div></div><div className="p-6">{message ? <p className="mb-4 rounded-xl bg-[#fde5e7] px-3 py-2 text-sm text-[#9f3144]">{message}</p> : null}
    {step === 1 && <><h3 className="font-serif text-2xl italic">1. Elige tu atención</h3><div className="mt-4 space-y-3">{services.length ? services.map((service) => <button key={service.slug} onClick={() => { setSelectedService(service); setStep(2); }} className="w-full rounded-2xl border border-[#ddcbc4] bg-white p-4 text-left transition hover:border-[#e97586] hover:bg-[#fff5f3]"><b>{service.name}</b><p className="mt-1 text-sm leading-5 text-[#715f65]">{service.description}</p><p className="mt-3 text-xs font-bold text-[#a0505e]">{service.priceNote} · {service.durationNote}</p></button>) : <p className="rounded-xl bg-[#f3e8e3] p-4 text-sm text-[#715f65]">El catálogo está siendo actualizado. Vuelve a intentarlo en unos minutos.</p>}</div></>}
    {step === 2 && <><button onClick={() => setStep(1)} className="inline-flex items-center gap-1 text-sm font-bold text-[#9e5060]"><ChevronLeft size={16} /> Cambiar servicio</button><h3 className="mt-3 font-serif text-2xl italic">2. Elige tu horario</h3><p className="mt-1 text-sm text-[#715f65]">Al seleccionar un cupo quedará reservado para ti durante 15 minutos.</p><div className="mt-4 space-y-2">{slots.length ? slots.map((slot) => <button key={slot.id} disabled={loading} onClick={() => chooseSlot(slot)} className="flex w-full items-center justify-between rounded-xl border border-[#ddcbc4] bg-white px-4 py-3 text-left hover:border-[#e97586] disabled:opacity-60"><span className="font-bold">{format.format(new Date(slot.startsAt))}</span><Clock3 size={17} className="text-[#d85f73]" /></button>) : <p className="rounded-xl bg-[#f3e8e3] p-4 text-sm text-[#715f65]">Todavía no hay horarios disponibles. Puedes volver pronto o contactar a Natalia para orientación.</p>}</div></>}
    {step === 3 && <form onSubmit={confirmReservation}><button type="button" onClick={() => setStep(2)} className="inline-flex items-center gap-1 text-sm font-bold text-[#9e5060]"><ChevronLeft size={16} /> Cambiar horario</button><h3 className="mt-3 font-serif text-2xl italic">3. Confirma tus datos</h3>{hold ? <p className="mt-2 rounded-xl bg-[#fff0bc] px-3 py-2 text-sm"><Clock3 size={15} className="mr-1 inline" />Cupo retenido hasta las {new Intl.DateTimeFormat("es-CL", { timeStyle: "short" }).format(new Date(hold.holdExpiresAt))}.</p> : null}<div className="mt-4 grid gap-3"><input required placeholder="Nombre y apellido" value={customer.fullName} onChange={(event) => setCustomer({ ...customer, fullName: event.target.value })} className="rounded-xl border border-[#ddcbc4] bg-white px-3 py-3" /><input required type="email" placeholder="Correo electrónico" value={customer.email} onChange={(event) => setCustomer({ ...customer, email: event.target.value })} className="rounded-xl border border-[#ddcbc4] bg-white px-3 py-3" /><input required type="tel" placeholder="WhatsApp / teléfono" value={customer.whatsapp} onChange={(event) => setCustomer({ ...customer, whatsapp: event.target.value })} className="rounded-xl border border-[#ddcbc4] bg-white px-3 py-3" /><textarea placeholder="Comentario opcional" value={customer.note} onChange={(event) => setCustomer({ ...customer, note: event.target.value })} className="min-h-20 rounded-xl border border-[#ddcbc4] bg-white px-3 py-3" /></div><button disabled={loading} className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-[#e97085] px-4 py-3 font-bold text-[#2b171b] disabled:opacity-60">{loading ? <><LoaderCircle size={18} className="animate-spin" /> Confirmando…</> : "Confirmar reserva de prueba"}</button><p className="mt-3 text-center text-xs leading-5 text-[#76636a]">No se cobra dinero en esta etapa. La confirmación queda registrada en el entorno de prueba.</p></form>}
    {step === 4 && <div className="py-4 text-center"><span className="mx-auto grid h-14 w-14 place-items-center rounded-full bg-[#e3f0dc] text-[#37643b]"><CalendarCheck2 size={28} /></span><h3 className="mt-4 font-serif text-3xl italic">Reserva registrada</h3><p className="mx-auto mt-3 max-w-sm text-sm leading-6 text-[#715f65]">Tu solicitud de prueba quedó registrada con el número <b>#{bookingId}</b>. Cuando el pago real esté activado, este paso te llevará a un checkout seguro.</p><p className="mt-4 inline-flex items-center gap-2 rounded-full bg-[#fff0bc] px-3 py-2 text-xs font-bold"><ShieldCheck size={15} />Sin cobro real en staging</p><button onClick={() => close(false)} className="mt-6 block w-full rounded-xl bg-[#2b2022] px-4 py-3 font-bold text-white">Volver al sitio</button></div>}
  </div></DialogContent></Dialog>;
}
