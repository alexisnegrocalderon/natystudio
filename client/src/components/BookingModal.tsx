import * as React from "react";
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
  const progress = ["Servicio", "Horario", "Tus datos", "Confirmación"];

  useEffect(() => {
    if (!open) return;
    request<{ slots: Slot[] }>("/api/slots")
      .then((data) => setSlots(data.slots))
      .catch((error) => setMessage(error instanceof Error ? error.message : "No fue posible cargar los horarios."));
  }, [open]);

  function close(value: boolean) {
    onOpenChange(value);
    if (!value) {
      setStep(1);
      setSelectedService(null);
      setHold(null);
      setMessage("");
      setBookingId(null);
    }
  }

  async function chooseSlot(slot: Slot) {
    setLoading(true);
    setMessage("");
    try {
      const data = await request<{ hold: Hold }>("/api/slots/hold", { method: "POST", body: JSON.stringify({ slotId: slot.id }) });
      setHold(data.hold);
      setStep(3);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "El horario ya no está disponible.");
      const fresh = await request<{ slots: Slot[] }>("/api/slots");
      setSlots(fresh.slots);
    } finally {
      setLoading(false);
    }
  }

  async function confirmReservation(event: React.FormEvent) {
    event.preventDefault();
    if (!selectedService || !hold) return;
    setLoading(true);
    setMessage("");
    try {
      const data = await request<{ booking: { id: number } }>("/api/bookings", {
        method: "POST",
        body: JSON.stringify({ ...customer, serviceSlug: selectedService.slug, holdToken: hold.holdToken, idempotencyKey: crypto.randomUUID() }),
      });
      setBookingId(data.booking.id);
      setStep(4);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "No fue posible confirmar la reserva.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={close}>
      <DialogContent className="max-h-[88vh] overflow-y-auto border-[#EFB7C6] bg-[#FFF8FA] p-0 text-[#351826] shadow-[0_24px_70px_rgba(53,24,38,.24)] sm:max-w-xl" showCloseButton={false}>
        <div className="bg-[#351826] px-6 py-6 text-[#FFDBDB]">
          <DialogHeader>
            <DialogTitle className="font-serif text-3xl italic">Reserva tu hora</DialogTitle>
            <DialogDescription className="mt-2 text-[#FDC3D1]">Agenda tu atención directamente en el sitio. El checkout se resolverá mediante la plataforma central de ANC; mientras se habilita en staging no se realizarán cobros.</DialogDescription>
          </DialogHeader>
          <div className="mt-5 grid grid-cols-4 gap-2" aria-label="Progreso de reserva">
            {progress.map((label, index) => <div key={label}><div className={`h-1 rounded-full transition-colors ${step >= index + 1 ? "bg-[#FF5C89]" : "bg-white/20"}`} /><span className="mt-2 block text-[10px] uppercase tracking-wide text-[#FDC3D1]">{label}</span></div>)}
          </div>
        </div>

        <div className="p-6">
          {message ? <p role="alert" className="mb-4 rounded-xl border border-[#FDA8BF] bg-[#FFDBDB] px-3 py-2 text-sm text-[#8E3556]">{message}</p> : null}

          {step === 1 && <><h3 className="font-serif text-2xl italic">1. Elige tu atención</h3><div className="mt-4 space-y-3">{services.length ? services.map((service) => <button key={service.slug} type="button" onClick={() => { setSelectedService(service); setStep(2); }} className="w-full rounded-2xl border border-[#EFB7C6] bg-white p-4 text-left transition hover:-translate-y-0.5 hover:border-[#FF5C89] hover:bg-[#FFF3F6] active:scale-[.99]"><b>{service.name}</b><p className="mt-1 text-sm leading-5 text-[#75495B]">{service.description}</p><p className="mt-3 text-xs font-bold text-[#8E3556]">{service.priceNote} · {service.durationNote}</p></button>) : <p className="rounded-xl bg-[#FFDBDB] p-4 text-sm text-[#75495B]">El catálogo está siendo actualizado. Vuelve a intentarlo en unos minutos.</p>}</div></>}

          {step === 2 && <><button type="button" onClick={() => setStep(1)} className="inline-flex items-center gap-1 text-sm font-bold text-[#8E3556] hover:text-[#FF5C89]"><ChevronLeft size={16} /> Cambiar servicio</button><h3 className="mt-3 font-serif text-2xl italic">2. Elige tu horario</h3><p className="mt-1 text-sm text-[#75495B]">Al seleccionar un cupo quedará reservado para ti durante 15 minutos.</p><div className="mt-4 space-y-2">{slots.length ? slots.map((slot) => <button key={slot.id} type="button" disabled={loading} onClick={() => chooseSlot(slot)} className="flex w-full items-center justify-between rounded-xl border border-[#EFB7C6] bg-white px-4 py-3 text-left transition hover:border-[#FF5C89] hover:bg-[#FFF3F6] disabled:opacity-60"><span className="font-bold">{format.format(new Date(slot.startsAt))}</span><Clock3 size={17} className="text-[#FF5C89]" /></button>) : <p className="rounded-xl bg-[#FFDBDB] p-4 text-sm text-[#75495B]">Todavía no hay horarios disponibles. Puedes volver pronto o contactar a Natalia para orientación.</p>}</div></>}

          {step === 3 && <form onSubmit={confirmReservation}><button type="button" onClick={() => setStep(2)} className="inline-flex items-center gap-1 text-sm font-bold text-[#8E3556] hover:text-[#FF5C89]"><ChevronLeft size={16} /> Cambiar horario</button><h3 className="mt-3 font-serif text-2xl italic">3. Confirma tus datos</h3>{hold ? <p className="mt-2 rounded-xl border border-[#FDA8BF] bg-[#FFDBDB] px-3 py-2 text-sm text-[#8E3556]"><Clock3 size={15} className="mr-1 inline" />Cupo retenido hasta las {new Intl.DateTimeFormat("es-CL", { timeStyle: "short" }).format(new Date(hold.holdExpiresAt))}.</p> : null}<div className="mt-4 grid gap-3"><label className="grid gap-1 text-sm font-semibold">Nombre y apellido<input required autoComplete="name" value={customer.fullName} onChange={(event) => setCustomer({ ...customer, fullName: event.target.value })} className="rounded-xl border border-[#EFB7C6] bg-white px-3 py-3 font-normal outline-none focus:border-[#FF5C89] focus:ring-2 focus:ring-[#FDA8BF]" /></label><label className="grid gap-1 text-sm font-semibold">Correo electrónico<input required type="email" autoComplete="email" value={customer.email} onChange={(event) => setCustomer({ ...customer, email: event.target.value })} className="rounded-xl border border-[#EFB7C6] bg-white px-3 py-3 font-normal outline-none focus:border-[#FF5C89] focus:ring-2 focus:ring-[#FDA8BF]" /></label><label className="grid gap-1 text-sm font-semibold">WhatsApp o teléfono<input required type="tel" autoComplete="tel" value={customer.whatsapp} onChange={(event) => setCustomer({ ...customer, whatsapp: event.target.value })} className="rounded-xl border border-[#EFB7C6] bg-white px-3 py-3 font-normal outline-none focus:border-[#FF5C89] focus:ring-2 focus:ring-[#FDA8BF]" /></label><label className="grid gap-1 text-sm font-semibold">Comentario opcional<textarea value={customer.note} onChange={(event) => setCustomer({ ...customer, note: event.target.value })} className="min-h-20 rounded-xl border border-[#EFB7C6] bg-white px-3 py-3 font-normal outline-none focus:border-[#FF5C89] focus:ring-2 focus:ring-[#FDA8BF]" /></label></div><button disabled={loading} className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-[#FF5C89] px-4 py-3 font-bold text-[#351826] transition hover:bg-[#FB8CAC] active:scale-[.99] disabled:opacity-60">{loading ? <><LoaderCircle size={18} className="animate-spin" /> Confirmando…</> : "Confirmar reserva de prueba"}</button><p className="mt-3 text-center text-xs leading-5 text-[#75495B]">No se cobra dinero en esta etapa. La confirmación queda registrada en el entorno de prueba.</p></form>}

          {step === 4 && <div className="py-4 text-center"><span className="mx-auto grid h-14 w-14 place-items-center rounded-full bg-[#DFF1E6] text-[#3F6B57]"><CalendarCheck2 size={28} /></span><h3 className="mt-4 font-serif text-3xl italic">Reserva registrada</h3><p className="mx-auto mt-3 max-w-sm text-sm leading-6 text-[#75495B]">Tu solicitud de prueba quedó registrada con el número <b>#{bookingId}</b>. Cuando el pago real esté activado, este paso te llevará a un checkout seguro.</p><p className="mt-4 inline-flex items-center gap-2 rounded-full bg-[#FFDBDB] px-3 py-2 text-xs font-bold text-[#8E3556]"><ShieldCheck size={15} />Sin cobro real en staging</p><button type="button" onClick={() => close(false)} className="mt-6 block w-full rounded-xl bg-[#351826] px-4 py-3 font-bold text-[#FFDBDB] transition hover:bg-[#542438] active:scale-[.99]">Volver al sitio</button></div>}
        </div>
      </DialogContent>
    </Dialog>
  );
}
