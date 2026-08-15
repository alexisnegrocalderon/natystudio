import { useState } from "react";
import {
  ArrowRight,
  Check,
  ChevronDown,
  Clock3,
  GraduationCap,
  Instagram,
  MapPin,
  Menu,
  MessageCircle,
  ShieldCheck,
  Sparkles,
  Stethoscope,
  X,
} from "lucide-react";
import { INSTAGRAM_URL, whatsappWithMessage } from "@/lib/landing";
import {
  aboutContent,
  courseContent,
  faqContent,
  footerContent,
  gallerySlots,
  languages,
  navItems,
  serviceContent,
  type Language,
} from "@/content/natyContent";

const bookingUrl = whatsappWithMessage("Hola Natalia, quiero reservar una evaluación para retiro de acrocordones.");
const courseUrl = whatsappWithMessage("Hola Natalia, me interesa recibir información sobre la formación para profesionales.");
const questionUrl = whatsappWithMessage("Hola Natalia, tengo una pregunta antes de reservar una evaluación.");

function ReserveButton({ href = bookingUrl, children, subtle = false }: { href?: string; children: React.ReactNode; subtle?: boolean }) {
  return (
    <a className={`reserve-button ${subtle ? "reserve-button--subtle" : ""}`} href={href} target="_blank" rel="noreferrer">
      <span>{children}</span>
      <ArrowRight size={18} aria-hidden="true" />
    </a>
  );
}

export default function Home() {
  const [menuOpen, setMenuOpen] = useState(false);
  const [activeLanguage, setActiveLanguage] = useState<Language>("ES");

  return (
    <main className="redesign-shell">
      <header className="redesign-header">
        <a className="brand-lockup" href="#inicio" aria-label="Naty studio, inicio">
          <span className="brand-name">naty.studio</span>
          <span>enfermera estética</span>
        </a>

        <nav className="redesign-nav" aria-label="Navegación principal">
          {navItems.map(([label, href]) => <a key={href} href={href}>{label}</a>)}
        </nav>

        <div className="header-actions">
          <div className="language-picker" aria-label="Selector de idioma">
            {languages.map((language) => (
              <button key={language} type="button" aria-pressed={activeLanguage === language} onClick={() => setActiveLanguage(language)}>{language}</button>
            ))}
          </div>
          <ReserveButton>Reservar con Natalia</ReserveButton>
        </div>

        <button className="redesign-menu" type="button" aria-label={menuOpen ? "Cerrar menú" : "Abrir menú"} aria-expanded={menuOpen} onClick={() => setMenuOpen((open) => !open)}>
          {menuOpen ? <X size={23} /> : <Menu size={23} />}
        </button>
        {menuOpen && (
          <div className="mobile-drawer">
            {navItems.map(([label, href]) => <a key={href} href={href} onClick={() => setMenuOpen(false)}>{label}</a>)}
            <ReserveButton>Reservar con Natalia</ReserveButton>
          </div>
        )}
      </header>

      <section id="inicio" className="new-hero">
        <div className="new-hero-copy">
          <p className="section-kicker"><span />Atención presencial en Valparaíso</p>
          <h1>El cuidado de tu piel, <em>en manos expertas.</em></h1>
          <p className="hero-summary">Soy Natalia, enfermera estética especializada en retiro de acrocordones. Te acompaño con una atención cercana, clara y responsable desde la primera consulta.</p>
          <div className="hero-ctas">
            <ReserveButton>Quiero reservar con Natalia</ReserveButton>
            <a className="quiet-link" href="#procedimiento">Conocer el procedimiento <ArrowRight size={16} /></a>
          </div>
          <div className="hero-assurance">
            <ShieldCheck size={21} />
            <p><strong>Atención personalizada.</strong> Cada caso comienza con orientación e indicaciones claras.</p>
          </div>
        </div>

        <div className="new-hero-visual">
          <div className="hero-sun" />
          <div className="portrait-mat"><img src="https://files.manuscdn.com/user_upload_by_module/session_file/310519663820533004/SeLkcsNjZfEfQVyP.jpeg" alt="Natalia, enfermera estética" /></div>
          <div className="availability-note"><span className="availability-dot" />Agenda abierta <strong>Valparaíso</strong></div>
          <p className="hero-signature">Natalia<br /><span>Enfermera estética</span></p>
        </div>
      </section>

      <section className="pathways" aria-label="Formas de conocer naty.studio">
        <a href={bookingUrl} target="_blank" rel="noreferrer" className="pathway-card pathway-card--rose">
          <MessageCircle size={24} /><span>01</span><h2>Reserva una<br /><em>evaluación</em></h2><p>Coordina tu atención directamente con Natalia por WhatsApp.</p><ArrowRight className="pathway-arrow" size={21} />
        </a>
        <a href="#procedimiento" className="pathway-card">
          <Stethoscope size={24} /><span>02</span><h2>Conoce el<br /><em>procedimiento</em></h2><p>Información simple para que sepas qué esperar de tu atención.</p><ArrowRight className="pathway-arrow" size={21} />
        </a>
        <a href="#curso" className="pathway-card">
          <GraduationCap size={24} /><span>03</span><h2>Aprende con<br /><em>Natalia</em></h2><p>Formación para profesionales de salud y estética.</p><ArrowRight className="pathway-arrow" size={21} />
        </a>
      </section>

      <section id="procedimiento" className="procedure-section content-width">
        <div className="procedure-intro">
          <p className="section-kicker"><span />Retiro de acrocordones</p>
          <h2>Una atención clara, <em>sin complicarla.</em></h2>
          <p>La consulta está diseñada para que conozcas cada paso, resuelvas tus dudas y recibas orientación de acuerdo con tu caso.</p>
        </div>
        <div className="procedure-detail">
          <article className="service-detail-card">
            <p className="detail-number">Servicio 01</p>
            <h3>{serviceContent.title}</h3>
            <p>{serviceContent.description}</p>
            <div className="detail-facts">
              <p><span>VALOR</span>{serviceContent.value}</p>
              <p><span>DURACIÓN</span>{serviceContent.duration}</p>
            </div>
            <ReserveButton>Reservar mi evaluación</ReserveButton>
          </article>
          <ol className="care-steps">
            <li><span>1</span><div><h3>Conversemos</h3><p>Escríbenos por WhatsApp y cuéntanos qué deseas evaluar.</p></div></li>
            <li><span>2</span><div><h3>Te orientamos</h3><p>Recibes información clara sobre la atención y los próximos pasos.</p></div></li>
            <li><span>3</span><div><h3>Atención y cuidado</h3><p>Luego de tu atención, tendrás indicaciones personalizadas.</p></div></li>
          </ol>
        </div>
      </section>

      <section id="sobre-mi" className="about-redesign">
        <div className="about-redesign-inner content-width">
          <div className="about-panel"><span className="panel-caption">Cuidado profesional<br />con una mirada humana.</span><div className="panel-illustration"><span>n</span><i /></div></div>
          <div className="about-redesign-copy">
            <p className="section-kicker"><span />Sobre Natalia</p>
            <h2>Tu tranquilidad también forma parte de la <em>atención.</em></h2>
            {aboutContent.paragraphs.map((paragraph) => <p key={paragraph}>{paragraph}</p>)}
            <div className="credibility-list">
              {aboutContent.points.map((point) => <p key={point}><Check size={17} />{point}</p>)}
            </div>
            <ReserveButton subtle>Hablar con Natalia</ReserveButton>
          </div>
        </div>
      </section>

      <section id="resultados" className="gallery-redesign content-width">
        <div className="gallery-header">
          <div><p className="section-kicker"><span />Resultados con privacidad</p><h2>El respeto por cada caso, <em>siempre primero.</em></h2></div>
          <p>Las fotografías de resultados se comparten exclusivamente con autorización. Mientras se incorporan casos al sitio, puedes conocer el trabajo de Natalia en Instagram.</p>
        </div>
        <div className="gallery-layout">
          <a className="instagram-invite" href={INSTAGRAM_URL} target="_blank" rel="noreferrer"><Instagram size={24} /><span>Conoce naty.studio<br /><strong>en Instagram</strong></span><ArrowRight size={20} /></a>
          {gallerySlots.map((slot, index) => <article className={`gallery-case case-${index + 1}`} key={`${slot.caseLabel}-${slot.state}`}><span>{slot.caseLabel}</span><div><ShieldCheck size={18} /><strong>{slot.state}</strong></div><p>{slot.note}</p></article>)}
        </div>
      </section>

      <section id="curso" className="education-redesign">
        <div className="content-width education-inner">
          <div className="education-copy"><p className="section-kicker section-kicker--dark"><span />Formación para profesionales</p><h2>Aprende una técnica desde una mirada <em>profesional.</em></h2><p>{courseContent.description}</p><ReserveButton href={courseUrl}>Quiero información del curso</ReserveButton></div>
          <div className="education-side"><div className="course-badge"><GraduationCap size={27} /><span>Formación<br />naty.studio</span></div><div className="course-fact"><span>DIRIGIDO A</span><strong>{courseContent.audience}</strong></div><div className="course-fact"><span>MODALIDAD</span><strong>{courseContent.modality}</strong></div></div>
        </div>
      </section>

      <section id="preguntas" className="faq-redesign content-width">
        <div className="faq-title"><p className="section-kicker"><span />Antes de reservar</p><h2>Resolvamos tus <em>preguntas.</em></h2><p>Si necesitas una orientación adicional, Natalia está disponible por WhatsApp.</p><ReserveButton href={questionUrl} subtle>Hacer una consulta</ReserveButton></div>
        <div className="faq-accordion">
          {faqContent.items.map((item, index) => <details key={item.question}><summary><span>0{index + 1}</span>{item.question}<ChevronDown size={19} /></summary><p>{item.answer}</p></details>)}
        </div>
      </section>

      <section className="final-reserve">
        <div className="content-width final-reserve-inner"><Sparkles size={23} /><p className="section-kicker section-kicker--dark"><span />Tu próxima atención</p><h2>Reserva tu evaluación <em>con Natalia.</em></h2><p>Escríbenos por WhatsApp para conocer disponibilidad y resolver cualquier duda antes de tu visita.</p><ReserveButton>Reservar por WhatsApp</ReserveButton></div>
      </section>

      <footer className="redesign-footer">
        <div className="content-width footer-main"><a className="brand-lockup" href="#inicio"><span className="brand-name">naty.studio</span><span>enfermera estética</span></a><p>{footerContent.description}</p><div><a href={bookingUrl} target="_blank" rel="noreferrer"><MessageCircle size={17} /> WhatsApp</a><a href={INSTAGRAM_URL} target="_blank" rel="noreferrer"><Instagram size={17} /> Instagram</a></div></div>
        <div className="content-width footer-meta"><span><MapPin size={15} /> {footerContent.location}</span><span>© {new Date().getFullYear()} naty.studio</span></div>
      </footer>
    </main>
  );
}

