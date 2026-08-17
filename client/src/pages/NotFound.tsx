import { ArrowUpRight, CircleAlert, Home } from "lucide-react";
import { useLocation } from "wouter";

export default function NotFound() {
  const [, setLocation] = useLocation();

  return (
    <main className="grid min-h-screen place-items-center overflow-hidden bg-[#351826] px-5 py-10 text-[#351826]">
      <section className="relative w-full max-w-2xl overflow-hidden rounded-[2rem] border border-[#FDA8BF]/60 bg-[#FFF8FA] p-7 shadow-[0_24px_70px_rgba(0,0,0,.25)] sm:p-12">
        <div className="absolute -right-20 -top-20 h-52 w-52 rounded-full bg-[#FDC3D1]" aria-hidden="true" />
        <div className="relative">
          <div className="grid h-14 w-14 place-items-center rounded-full bg-[#FFDBDB] text-[#8E3556]"><CircleAlert size={27} /></div>
          <p className="mt-8 text-xs font-bold uppercase tracking-[.22em] text-[#8E3556]">Error 404</p>
          <h1 className="mt-3 max-w-lg font-serif text-5xl italic leading-[.88] sm:text-6xl">Esta página <span className="text-[#FF5C89]">no está aquí.</span></h1>
          <p className="mt-6 max-w-md text-sm leading-6 text-[#75495B]">Puede que el enlace haya cambiado o que la dirección no exista. Vuelve al sitio principal para conocer los servicios, resolver dudas o reservar una evaluación.</p>
          <button type="button" onClick={() => setLocation("/")} className="mt-8 inline-flex items-center gap-2 rounded-full bg-[#351826] px-5 py-3 text-sm font-bold text-[#FFDBDB] transition hover:bg-[#542438] active:scale-[.98]"><Home size={16} /> Volver al inicio <ArrowUpRight size={16} /></button>
        </div>
      </section>
    </main>
  );
}
