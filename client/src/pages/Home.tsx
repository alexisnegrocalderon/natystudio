import { useEffect, useState } from "react";
import {
  ArrowDownRight,
  ArrowUpRight,
  Check,
  ChevronDown,
  GraduationCap,
  Instagram,
  MapPin,
  Menu,
  MessageCircle,
  ShieldCheck,
  Sparkles,
  X,
} from "lucide-react";
import { COURSE_SECTION_ID, getPilotCatalogState, INSTAGRAM_URL, whatsappWithMessage } from "@/lib/landing";
import { trpc } from "@/lib/trpc";
import { aboutContent, courseContent, faqContent, footerContent, gallerySlots, navItems, serviceContent } from "@/content/natyContent";
import { BookingModal } from "@/components/BookingModal";
import "../pilot.css";

const LOGO_URL = "https://files.manuscdn.com/user_upload_by_module/session_file/310519663820533004/gimEZJCjXoLkQZdV.jpeg";
const PORTRAIT_URL = "https://files.manuscdn.com/user_upload_by_module/session_file/310519663820533004/SeLkcsNjZfEfQVyP.jpeg";
const HERO_VIDEO_URL = "/manus-storage/natalia-macro-skin-hero_12cf4a5f.mp4";
const HERO_POSTER_URL = "/manus-storage/natalia-editorial-hero-poster_42db3d86.jpg";
const TEXTURE_URL = "/manus-storage/natalia-editorial-texture-pink_2a3badef.jpg";
const ORBIT_URL = "/manus-storage/natalia-editorial-orbit_f2d9b696.jpg";
const bookingUrl = whatsappWithMessage("Hola Natalia, quiero reservar una evaluación para retiro de acrocordones.");
const questionUrl = whatsappWithMessage("Hola Natalia, tengo una pregunta antes de reservar una evaluación.");

type PreviewService = {
  slug: string;
  name: string;
  description: string;
  priceNote: string;
  durationNote: string;
};

type PublishedLandingCopy = { heroTitle?: string; heroSubtitle?: string; about?: string };

function usePreviewCatalog(enabled: boolean) {
  const [services, setServices] = useState<PreviewService[] | undefined>();
  const [isLoading, setIsLoading] = useState(enabled);
  const [isError, setIsError] = useState(false);

  useEffect(() => {
    if (!enabled) return;
    const controller = new AbortController();
    setIsLoading(true);
    fetch("/api/pilot-services", { signal: controller.signal })
      .then(async (response) => {
        if (!response.ok) throw new Error("pilot_catalog_unavailable");
        return response.json() as Promise<{ services?: PreviewService[] }>;
      })
      .then((payload) => setServices(payload.services ?? []))
      .catch((error: unknown) => {
        if (error instanceof DOMException && error.name === "AbortError") return;
        setIsError(true);
      })
      .finally(() => setIsLoading(false));
    return () => controller.abort();
  }, [enabled]);

  return { services, isLoading, isError };
}

function usePublishedLandingCopy() {
  const [copy, setCopy] = useState<PublishedLandingCopy | null>(null);
  useEffect(() => {
    const controller = new AbortController();
    fetch("/api/landing-content", { signal: controller.signal })
      .then((response) => (response.ok ? response.json() as Promise<{ content?: PublishedLandingCopy | null }> : null))
      .then((payload) => { if (payload?.content) setCopy(payload.content); })
      .catch(() => setCopy(null));
    return () => controller.abort();
  }, []);
  return copy;
}

function BookingCTA({ children, onClick, tone = "dark" }: { children: React.ReactNode; onClick: () => void; tone?: "dark" | "light" | "pink" }) {
  return <button type="button" className={`nr-button nr-button--${tone}`} onClick={onClick}><span>{children}</span><ArrowUpRight size={17} /></button>;
}

function Wordmark({ compact = false }: { compact?: boolean }) {
  return <a href="#inicio" className={`nr-wordmark ${compact ? "nr-wordmark--compact" : ""}`} aria-label="Natalia Rodríguez Studio, inicio"><img src={LOGO_URL} alt="Natalia Rodríguez Studio" /></a>;
}

export default function Home() {
  const [menuOpen, setMenuOpen] = useState(false);
  const [bookingOpen, setBookingOpen] = useState(false);
  const pilotCatalogQuery = trpc.nataliaPilot.services.useQuery();
  const previewCatalog = usePreviewCatalog(pilotCatalogQuery.isError);
  const publishedCopy = usePublishedLandingCopy();
  const pilotServices = pilotCatalogQuery.data ?? previewCatalog.services;
  const primaryService = pilotServices?.[0];
  const catalogState = getPilotCatalogState({
    isLoading: pilotCatalogQuery.isLoading || (pilotCatalogQuery.isError && previewCatalog.isLoading),
    isError: pilotCatalogQuery.isError && previewCatalog.isError,
    hasService: Boolean(primaryService),
  });

  const service = primaryService ?? {
    slug: "evaluacion",
    name: serviceContent.title,
    description: serviceContent.description,
    priceNote: serviceContent.value,
    durationNote: serviceContent.duration,
  };

  return (
    <main className="nr-site">
      <header className="nr-header">
        <Wordmark compact />
        <nav className="nr-nav" aria-label="Navegación principal">
          {navItems.map(([label, href]) => <a key={href} href={href}>{label}</a>)}
        </nav>
        <div className="nr-header-actions">
          <a className="nr-admin-link" href="/admin">Mi estudio</a>
          <BookingCTA tone="pink" onClick={() => setBookingOpen(true)}>Reservar</BookingCTA>
        </div>
        <button className="nr-menu" type="button" aria-expanded={menuOpen} aria-label={menuOpen ? "Cerrar menú" : "Abrir menú"} onClick={() => setMenuOpen((open) => !open)}>{menuOpen ? <X size={23} /> : <Menu size={23} />}</button>
        {menuOpen ? <div className="nr-mobile-nav">
          {navItems.map(([label, href]) => <a key={href} href={href} onClick={() => setMenuOpen(false)}>{label}</a>)}
          <BookingCTA tone="pink" onClick={() => { setMenuOpen(false); setBookingOpen(true); }}>Reservar mi hora</BookingCTA>
        </div> : null}
      </header>

      <section id="inicio" className="nr-hero">
        <video className="nr-hero-video" autoPlay muted loop playsInline poster={HERO_POSTER_URL} aria-hidden="true">
          <source src={HERO_VIDEO_URL} type="video/mp4" />
        </video>
        <div className="nr-hero-overlay" />
        <div className="nr-hero-grid">
          <div className="nr-hero-copy">
            <div className="nr-kicker"><Sparkles size={14} /> Estética profesional · Valparaíso</div>
            <div className="nr-hero-logo-panel"><Wordmark /></div>
            <p className="nr-eyebrow">CUIDADO QUE SE SIENTE CERCA</p>
            <h1>{publishedCopy?.heroTitle || <>Tu piel,<br /><em>tu momento.</em></>}</h1>
            <p className="nr-hero-description">{publishedCopy?.heroSubtitle || "Una atención cercana, técnica y delicada para que vuelvas a sentirte cómoda en tu propia piel."}</p>
            <div className="nr-hero-cta-row"><BookingCTA tone="dark" onClick={() => setBookingOpen(true)}>Reservar con Natalia</BookingCTA><a className="nr-text-link" href="#servicios">Conocer servicios <ArrowDownRight size={17} /></a></div>
          </div>
          <aside className="nr-hero-note"><span>Agenda</span><strong>Abierta</strong><p>Elige tu atención, revisa los cupos y reserva desde aquí.</p><div className="nr-orbit-dot" /></aside>
          <div className="nr-hero-scroll">Desliza para descubrir <span>↓</span></div>
        </div>
      </section>

      <section className="nr-ticker" aria-label="Especialidades"><span>ATENCIÓN PERSONALIZADA</span><i>✦</i><span>RETIRO DE ACROCORDONES</span><i>✦</i><span>FORMACIÓN PROFESIONAL</span><i>✦</i><span>VALPARAÍSO, CHILE</span></section>

      <section id="servicios" className="nr-section nr-offer">
        <div className="nr-section-heading"><div><p className="nr-eyebrow">01 · SERVICIOS</p><h2>Un espacio para<br /><em>sentirte bien.</em></h2></div><p>Elige la atención que necesitas. Todo comienza con una conversación clara y una agenda pensada para ti.</p></div>
        <div className="nr-bento nr-offer-bento">
          <article className="nr-bento-service">
            <div className="nr-card-top"><span>Atención destacada</span><span className={`nr-live-dot nr-live-dot--${catalogState}`} aria-label="Estado del catálogo" /></div>
            <h3>{service.name}</h3>
            <p>{service.description}</p>
            <div className="nr-service-meta"><span>{service.priceNote}</span><span>{service.durationNote}</span></div>
            <BookingCTA tone="light" onClick={() => setBookingOpen(true)}>Ver disponibilidad</BookingCTA>
          </article>
          <figure className="nr-bento-image nr-bento-image--texture"><img src={TEXTURE_URL} alt="Textura editorial rosada de Natalia Rodríguez Studio" /></figure>
          <article className="nr-bento-process"><p className="nr-eyebrow">Tu reserva</p><ol><li><span>01</span><strong>Elige tu atención</strong></li><li><span>02</span><strong>Escoge tu horario</strong></li><li><span>03</span><strong>Confirma de forma segura</strong></li></ol><BookingCTA tone="pink" onClick={() => setBookingOpen(true)}>Reservar ahora</BookingCTA></article>
          <figure className="nr-bento-image nr-bento-image--orbit"><img src={ORBIT_URL} alt="Composición abstracta rosada" /><figcaption>Delicadeza<br />en cada detalle.</figcaption></figure>
        </div>
      </section>

      <section id="sobre-mi" className="nr-section nr-about">
        <div className="nr-about-image"><img src={PORTRAIT_URL} alt="Natalia Rodríguez, enfermera estética" /><div className="nr-about-stamp"><span>NR</span><small>STUDIO</small></div></div>
        <div className="nr-about-copy"><p className="nr-eyebrow">02 · CONOCE A NATALIA</p><h2>Tu piel merece una mirada<br /><em>profesional y cercana.</em></h2>{publishedCopy?.about ? <p className="nr-body-copy">{publishedCopy.about}</p> : aboutContent.paragraphs.map((paragraph) => <p className="nr-body-copy" key={paragraph}>{paragraph}</p>)}<div className="nr-check-list">{aboutContent.points.map((point) => <p key={point}><Check size={17} />{point}</p>)}</div><a className="nr-text-link nr-text-link--dark" href={bookingUrl} target="_blank" rel="noreferrer">Hablar con Natalia <ArrowUpRight size={17} /></a></div>
      </section>

      <section id="resultados" className="nr-section nr-results">
        <div className="nr-results-title"><p className="nr-eyebrow">03 · PRIVACIDAD Y RESULTADOS</p><h2>Todo cuidado comienza<br /><em>con confianza.</em></h2><p>Las fotografías de resultados se comparten solo con autorización. Mientras incorporamos nuevos casos, puedes conocer el trabajo de Natalia en Instagram.</p><a className="nr-instagram" href={INSTAGRAM_URL} target="_blank" rel="noreferrer"><Instagram size={21} /><span>Ver el trabajo de Natalia</span><ArrowUpRight size={18} /></a></div>
        <div className="nr-results-grid">{gallerySlots.map((slot, index) => <article key={slot.caseLabel} className={`nr-result-card nr-result-card--${index + 1}`}><span>{slot.caseLabel}</span><ShieldCheck size={20} /><strong>{slot.state}</strong><p>{slot.note}</p></article>)}</div>
      </section>

      <section id={COURSE_SECTION_ID} className="nr-section nr-course">
        <div className="nr-course-image"><img src={ORBIT_URL} alt="Textura temporal de formación profesional" /></div>
        <div className="nr-course-copy"><p className="nr-eyebrow">04 · FORMACIÓN PROFESIONAL</p><GraduationCap size={31} /><h2>Aprende desde una mirada<br /><em>clara y aplicada.</em></h2><p>{courseContent.description}</p><div className="nr-course-details"><span><b>Dirigido a</b>{courseContent.audience}</span><span><b>Modalidad</b>{courseContent.modality}</span></div><BookingCTA tone="dark" onClick={() => setBookingOpen(true)}>Conocer formación</BookingCTA></div>
      </section>

      <section id="preguntas" className="nr-section nr-faq">
        <div className="nr-faq-intro"><p className="nr-eyebrow">05 · PREGUNTAS FRECUENTES</p><h2>Antes de reservar,<br /><em>conversemos.</em></h2><p>Estamos aquí para que agendes con toda la información que necesitas.</p><a className="nr-text-link nr-text-link--dark" href={questionUrl} target="_blank" rel="noreferrer">Hacer una consulta <ArrowUpRight size={17} /></a></div>
        <div className="nr-accordion">{faqContent.items.map((item, index) => <details key={item.question}><summary><span>0{index + 1}</span>{item.question}<ChevronDown size={19} /></summary><p>{item.answer}</p></details>)}</div>
      </section>

      <section className="nr-final-cta"><div className="nr-final-content"><p className="nr-eyebrow">TU PRÓXIMA ATENCIÓN</p><h2>Haz espacio para<br /><em>sentirte bien.</em></h2><p>Revisa la agenda disponible y reserva tu atención sin salir del sitio.</p><BookingCTA tone="dark" onClick={() => setBookingOpen(true)}>Reservar mi hora</BookingCTA></div><div className="nr-final-visual"><img src={TEXTURE_URL} alt="Textura rosada abstracta" /><div className="nr-final-bubble">Tu<br />momento<br />empieza<br />aquí.</div></div></section>

      <footer className="nr-footer"><div className="nr-footer-main"><Wordmark compact /><p>{footerContent.description}</p><div className="nr-footer-links"><a href={bookingUrl} target="_blank" rel="noreferrer"><MessageCircle size={17} /> WhatsApp</a><a href={INSTAGRAM_URL} target="_blank" rel="noreferrer"><Instagram size={17} /> Instagram</a></div></div><div className="nr-footer-bottom"><span><MapPin size={15} /> {footerContent.location}</span><span>© {new Date().getFullYear()} Natalia Rodríguez Studio</span></div></footer>
      <BookingModal open={bookingOpen} onOpenChange={setBookingOpen} services={pilotServices ?? []} />
    </main>
  );
}
