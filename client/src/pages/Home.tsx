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
  Plus,
  ShieldCheck,
  Sparkles,
  Stethoscope,
  X,
} from "lucide-react";
import { COURSE_SECTION_ID, getPilotCatalogState, INSTAGRAM_URL, whatsappWithMessage } from "@/lib/landing";
import { trpc } from "@/lib/trpc";
import { aboutContent, courseContent, faqContent, footerContent, gallerySlots, languages, navItems, serviceContent, type Language } from "@/content/natyContent";
import { PilotServiceCard } from "@/components/PilotServiceCard";
import "../pilot.css";

const LOGO_URL = "https://files.manuscdn.com/user_upload_by_module/session_file/310519663820533004/gimEZJCjXoLkQZdV.jpeg";
const PORTRAIT_URL = "https://files.manuscdn.com/user_upload_by_module/session_file/310519663820533004/SeLkcsNjZfEfQVyP.jpeg";
const bookingUrl = whatsappWithMessage("Hola Natalia, quiero reservar una evaluación para retiro de acrocordones.");
const courseUrl = whatsappWithMessage("Hola Natalia, me interesa recibir información sobre la formación para profesionales.");
const questionUrl = whatsappWithMessage("Hola Natalia, tengo una pregunta antes de reservar una evaluación.");

type PreviewService = {
  slug: string;
  name: string;
  description: string;
  priceNote: string;
  durationNote: string;
};

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

function WhatsAppCTA({ children, href = bookingUrl, inverse = false }: { children: React.ReactNode; href?: string; inverse?: boolean }) {
  return <a className={`nr-cta ${inverse ? "nr-cta--inverse" : ""}`} href={href} target="_blank" rel="noreferrer"><span>{children}</span><ArrowUpRight size={18} /></a>;
}

function Logo({ compact = false }: { compact?: boolean }) {
  return <a href="#inicio" className={`nr-logo ${compact ? "nr-logo--compact" : ""}`} aria-label="Natalia Rodríguez Studio, inicio"><img src={LOGO_URL} alt="Natalia Rodríguez Studio" /></a>;
}

export default function Home() {
  const [menuOpen, setMenuOpen] = useState(false);
  const [activeLanguage, setActiveLanguage] = useState<Language>("ES");
  const pilotCatalogQuery = trpc.nataliaPilot.services.useQuery();
  const previewCatalog = usePreviewCatalog(pilotCatalogQuery.isError);
  const pilotServices = pilotCatalogQuery.data ?? previewCatalog.services;
  const isPilotCatalogError = pilotCatalogQuery.isError && previewCatalog.isError;
  const isPilotCatalogLoading = pilotCatalogQuery.isLoading || (pilotCatalogQuery.isError && previewCatalog.isLoading);
  const pilotService = pilotServices?.[0];
  const pilotCatalogState = getPilotCatalogState({
    isLoading: isPilotCatalogLoading,
    isError: isPilotCatalogError,
    hasService: Boolean(pilotService),
  });
  const pilotStatus = {
    loading: "Actualizando información del servicio…",
    fallback: "Mostramos información de respaldo mientras se restablece el catálogo.",
    empty: "El catálogo está en actualización. Agenda tu evaluación para recibir orientación.",
    ready: "Información disponible desde el entorno de preview.",
  }[pilotCatalogState];

  return (
    <main className="nr-site">
      <header className="nr-header">
        <Logo compact />
        <nav className="nr-nav" aria-label="Navegación principal">{navItems.map(([label, href]) => <a key={href} href={href}>{label}</a>)}</nav>
        <div className="nr-header-tools"><div className="nr-languages" aria-label="Selector de idioma">{languages.map((language) => <button key={language} type="button" aria-pressed={activeLanguage === language} onClick={() => setActiveLanguage(language)}>{language}</button>)}</div><WhatsAppCTA inverse>Reservar</WhatsAppCTA></div>
        <button className="nr-menu" type="button" aria-expanded={menuOpen} aria-label={menuOpen ? "Cerrar menú" : "Abrir menú"} onClick={() => setMenuOpen((open) => !open)}>{menuOpen ? <X size={23} /> : <Menu size={23} />}</button>
        {menuOpen && <div className="nr-mobile-nav">{navItems.map(([label, href]) => <a key={href} href={href} onClick={() => setMenuOpen(false)}>{label}</a>)}<WhatsAppCTA inverse>Reservar con Natalia</WhatsAppCTA></div>}
      </header>

      <section id="inicio" className="nr-hero">
        <div className="nr-hero-rail"><span>ENFERMERA ESTÉTICA</span><span>VALPARAÍSO · CHILE</span><span className="rail-star">✦</span></div>
        <div className="nr-hero-main">
          <p className="nr-overline">NATALIA RODRÍGUEZ STUDIO</p>
          <h1>CUIDADO<br />PARA TU<br /><em>PIEL.</em></h1>
          <div className="nr-hero-bottom"><p>Una atención cercana, profesional y clara para acompañarte desde la primera consulta.</p><WhatsAppCTA inverse>Reservar con Natalia</WhatsAppCTA></div>
        </div>
        <div className="nr-hero-media"><div className="media-title">TU ESPACIO<br />DE CUIDADO</div><div className="media-photo"><img src={PORTRAIT_URL} alt="Natalia Rodríguez, enfermera estética" /></div><div className="media-sticker"><span>AGENDA</span><strong>ABIERTA</strong><Plus size={16} /></div></div>
      </section>

      <section className="nr-marquee" aria-label="Especialidad de Natalia Rodríguez Studio"><span>RETIRO DE ACROCORDONES</span><i>✦</i><span>ATENCIÓN PERSONALIZADA</span><i>✦</i><span>FORMACIÓN PROFESIONAL</span></section>

      <section className="nr-intro-grid">
        <div className="intro-statement"><p className="nr-overline">01 · ATENCIÓN PRESENCIAL</p><h2>MENOS<br />DUDAS.<br /><em>MÁS CLARIDAD.</em></h2></div>
        <PilotServiceCard state={pilotCatalogState} service={pilotService} fallback={{ title: serviceContent.title, description: serviceContent.description, value: serviceContent.value, duration: serviceContent.duration }} statusMessage={pilotStatus}><WhatsAppCTA>Reservar mi evaluación</WhatsAppCTA></PilotServiceCard>
        <article className="intro-steps"><span className="block-number">EL PROCESO</span><ol><li><span>01</span><p><strong>Escríbenos</strong>Comparte qué necesitas evaluar por WhatsApp.</p></li><li><span>02</span><p><strong>Resolvemos dudas</strong>Te orientamos antes de coordinar tu hora.</p></li><li><span>03</span><p><strong>Te atendemos</strong>Recibes una atención e indicaciones personalizadas.</p></li></ol></article>
      </section>

      <section id="sobre-mi" className="nr-about">
        <div className="nr-about-panel"><Logo /><div className="panel-pink-circle" /><span>PROFESIONAL<br />Y CERCANA.</span></div>
        <div className="nr-about-copy"><p className="nr-overline">02 · CONOCE A NATALIA</p><h2>EL CONOCIMIENTO<br />TAMBIÉN SE NOTA<br /><em>EN CÓMO TE CUIDAN.</em></h2>{aboutContent.paragraphs.map((paragraph) => <p className="body-copy" key={paragraph}>{paragraph}</p>)}<div className="nr-checks">{aboutContent.points.map((point) => <p key={point}><Check size={17} />{point}</p>)}</div><WhatsAppCTA inverse>Hablar con Natalia</WhatsAppCTA></div>
      </section>

      <section id="resultados" className="nr-results">
        <div className="results-heading"><p className="nr-overline">03 · PRIVACIDAD Y RESULTADOS</p><h2>LO MÁS IMPORTANTE<br />ES QUE TE SIENTAS<br /><em>SEGURA.</em></h2></div>
        <div className="results-content"><p>Las fotografías de resultados se publican solamente con autorización. Mientras incorporamos nuevos casos, puedes conocer el trabajo de Natalia en Instagram.</p><a className="instagram-card" href={INSTAGRAM_URL} target="_blank" rel="noreferrer"><Instagram size={28} /><span>VER EL TRABAJO<br /><strong>EN INSTAGRAM</strong></span><ArrowDownRight size={23} /></a><div className="case-grid">{gallerySlots.map((slot, index) => <article className={`nr-case case-${index + 1}`} key={`${slot.caseLabel}-${slot.state}`}><span>{slot.caseLabel}</span><ShieldCheck size={21} /><strong>{slot.state}</strong><p>{slot.note}</p></article>)}</div></div>
      </section>

      <section id={COURSE_SECTION_ID} className="nr-course">
        <div className="course-sideword">FORMACIÓN</div><div className="course-main"><p className="nr-overline">04 · PARA PROFESIONALES</p><h2>APRENDE<br />CON UNA MIRADA<br /><em>PROFESIONAL.</em></h2><p>{courseContent.description}</p><WhatsAppCTA href={courseUrl} inverse>Quiero información</WhatsAppCTA></div><div className="course-meta"><GraduationCap size={31} /><p><span>DIRIGIDO A</span>{courseContent.audience}</p><p><span>MODALIDAD</span>{courseContent.modality}</p><div className="course-mark">NR<br /><small>STUDIO</small></div></div>
      </section>

      <section id="preguntas" className="nr-faq">
        <div className="faq-intro"><p className="nr-overline">05 · PREGUNTAS</p><h2>ANTES DE<br /><em>RESERVAR.</em></h2><p>Escríbenos si necesitas una orientación adicional. Natalia está disponible para ayudarte.</p><WhatsAppCTA href={questionUrl}>Hacer una consulta</WhatsAppCTA></div>
        <div className="nr-accordion">{faqContent.items.map((item, index) => <details key={item.question}><summary><span>0{index + 1}</span>{item.question}<ChevronDown size={20} /></summary><p>{item.answer}</p></details>)}</div>
      </section>

      <section className="nr-final"><div className="final-logo"><Logo /></div><div><p className="nr-overline">TU PRÓXIMA ATENCIÓN</p><h2>RESERVA CON<br /><em>NATALIA.</em></h2><p>Coordina tu evaluación por WhatsApp. Te respondemos con disponibilidad y la información que necesitas.</p><WhatsAppCTA>Reservar por WhatsApp</WhatsAppCTA></div><Sparkles className="final-sparkle" size={28} /></section>

      <footer className="nr-footer"><div className="footer-top"><Logo compact /><p>{footerContent.description}</p><div><a href={bookingUrl} target="_blank" rel="noreferrer"><MessageCircle size={17} /> WhatsApp</a><a href={INSTAGRAM_URL} target="_blank" rel="noreferrer"><Instagram size={17} /> Instagram</a></div></div><div className="footer-bottom"><span><MapPin size={15} /> {footerContent.location}</span><span>© {new Date().getFullYear()} Natalia Rodríguez Studio</span></div></footer>
    </main>
  );
}
