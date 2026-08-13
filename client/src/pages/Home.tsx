import { useState } from "react";
import {
  ArrowDownRight,
  ArrowUpRight,
  Check,
  ChevronDown,
  Clock3,
  GraduationCap,
  HeartPulse,
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
import { aboutContent, aboutSectionContent, authorityContent, contactContent, courseContent, faqContent, footerContent, gallerySlots, heroContent, languages, navItems, resultsContent, serviceContent, servicesSectionContent, testimonialContent, type Language } from "@/content/natyContent";

const bookingUrl = whatsappWithMessage("Hola, quiero agendar una evaluación para retiro de acrocordones.");
const courseUrl = whatsappWithMessage("Hola, me interesa recibir información sobre el curso para profesionales.");
const authorityIcons = [Stethoscope, ShieldCheck, GraduationCap];

function PrimaryLink({ href, children, className = "" }: { href: string; children: React.ReactNode; className?: string }) {
  return (
    <a className={`primary-link ${className}`} href={href} target="_blank" rel="noreferrer">
      <span>{children}</span>
      <ArrowUpRight size={18} aria-hidden="true" />
    </a>
  );
}

export default function Home() {
  const [menuOpen, setMenuOpen] = useState(false);
  const [activeLanguage, setActiveLanguage] = useState<Language>("ES");

  const closeMenu = () => setMenuOpen(false);

  return (
    <main className="site-shell">
      <header className="site-header">
        <a className="wordmark" href="#inicio" aria-label="naty.studio, inicio">
          naty<span>.</span>studio
        </a>

        <nav className="desktop-nav" aria-label="Navegación principal">
          {navItems.map(([label, href]) => (
            <a key={href} href={href}>{label}</a>
          ))}
        </nav>

        <div className="language-switcher" aria-label="Selector de idioma preparado para futuras traducciones">
          {languages.map((language) => (
            <button key={language} type="button" aria-pressed={activeLanguage === language} onClick={() => setActiveLanguage(language)}>
              {language}
            </button>
          ))}
        </div>

        <a className="header-cta" href={bookingUrl} target="_blank" rel="noreferrer">
          Agenda por WhatsApp <ArrowUpRight size={15} aria-hidden="true" />
        </a>

        <button
          className="menu-toggle"
          type="button"
          onClick={() => setMenuOpen((open) => !open)}
          aria-label={menuOpen ? "Cerrar menú" : "Abrir menú"}
          aria-expanded={menuOpen}
        >
          {menuOpen ? <X size={21} /> : <Menu size={21} />}
        </button>

        {menuOpen && (
          <nav className="mobile-nav" aria-label="Navegación móvil">
            {navItems.map(([label, href]) => (
              <a key={href} href={href} onClick={closeMenu}>{label}</a>
            ))}
            <a href={bookingUrl} target="_blank" rel="noreferrer" onClick={closeMenu}>
              Agendar por WhatsApp <ArrowUpRight size={16} />
            </a>
            <div className="mobile-language-switcher" aria-label="Selector de idioma preparado para futuras traducciones">
              {languages.map((language) => (
                <button key={language} type="button" aria-pressed={activeLanguage === language} onClick={() => setActiveLanguage(language)}>
                  {language}
                </button>
              ))}
            </div>
          </nav>
        )}
      </header>

      <section id="inicio" className="hero section-wrap">
        <div className="hero-copy reveal-up">
          <p className="eyebrow"><span className="eyebrow-dot" />{heroContent.eyebrow}</p>
          <h1>
            {heroContent.title}
            <em> {heroContent.accent}</em>
          </h1>
          <p className="hero-lede">
            {heroContent.lede}
          </p>
          <div className="hero-actions">
            <PrimaryLink href={bookingUrl}>{heroContent.primaryAction}</PrimaryLink>
            <a className="text-link" href="#curso">{heroContent.secondaryAction} <ArrowDownRight size={17} /></a>
          </div>
          <div className="hero-trust">
            <div className="trust-icon"><ShieldCheck size={21} /></div>
            <p>{heroContent.trust}</p>
          </div>
        </div>

        <div className="hero-art reveal-up delay-1" aria-label="Fotografía de Naty">
          <div className="hero-orb orb-one" />
          <div className="hero-orb orb-two" />
          <div className="portrait-frame">
            <img src="https://files.manuscdn.com/user_upload_by_module/session_file/310519663820533004/SeLkcsNjZfEfQVyP.jpeg" alt="Naty, enfermera estética" />
          </div>
          <div className="floating-note note-top">
            <Sparkles size={16} />
            <span>{heroContent.visualNote}</span>
          </div>
          <div className="floating-note note-bottom">
            <MapPin size={16} />
            <span>{heroContent.location}</span>
          </div>
          <p className="portrait-caption">{heroContent.portraitCaption}</p>
        </div>
      </section>

      <section className="authority-band" aria-label="Pilares profesionales">
        {authorityContent.map((item, index) => {
          const Icon = authorityIcons[index];
          return <div className="authority-item" key={item.title}><Icon size={21} /><p><strong>{item.title}</strong><span>{item.description}</span></p></div>;
        })}
      </section>

      <section id="servicios" className="section-wrap services-section">
        <div className="section-heading reveal-up">
          <p className="eyebrow">{servicesSectionContent.eyebrow}</p>
          <h2>{servicesSectionContent.title} <em>{servicesSectionContent.accent}</em></h2>
          <p>{servicesSectionContent.description}</p>
        </div>

        <article className="service-card reveal-up delay-1">
          <div className="service-card-top">
            <span className="service-index">01</span>
            <HeartPulse size={26} />
          </div>
          <h3>{serviceContent.title}</h3>
          <p>{serviceContent.description}</p>
          <div className="service-meta">
            <p><span>VALOR</span><strong>{serviceContent.value}</strong></p>
            <p><span>DURACIÓN</span><strong>{serviceContent.duration}</strong></p>
          </div>
          <PrimaryLink href={bookingUrl} className="service-cta">{servicesSectionContent.action}</PrimaryLink>
        </article>
      </section>

      <section id="sobre-mi" className="about-section section-wrap">
        <div className="about-visual reveal-up">
          <div className="about-grid-art">
            <div className="grid-line line-a" />
            <div className="grid-line line-b" />
            <div className="about-stamp"><span>n.s</span><small>VALPO · CL</small></div>
            <p>{aboutSectionContent.graphic}<br /><em>{aboutSectionContent.graphicAccent}</em></p>
          </div>
        </div>
        <div className="about-copy reveal-up delay-1">
          <p className="eyebrow">{aboutSectionContent.eyebrow}</p>
          <h2>{aboutSectionContent.title} <em>{aboutSectionContent.accent}</em></h2>
          {aboutContent.paragraphs.map((paragraph) => <p key={paragraph}>{paragraph}</p>)}
          <div className="about-points">
            {aboutContent.points.map((point) => <p key={point}><Check size={17} />{point}</p>)}
          </div>
          <a className="text-link light-link" href={bookingUrl} target="_blank" rel="noreferrer">{aboutSectionContent.action} <ArrowUpRight size={17} /></a>
        </div>
      </section>

      <section id="resultados" className="results-section section-wrap">
        <div className="section-heading results-heading reveal-up">
          <p className="eyebrow">{resultsContent.eyebrow}</p>
          <h2>{resultsContent.title} <em>{resultsContent.accent}</em></h2>
          <p>{resultsContent.description}</p>
        </div>
        <div className="results-content reveal-up delay-1">
          <div className="results-placeholder">
            <div className="privacy-seal"><ShieldCheck size={34} /><span>PRIVACIDAD<br />PRIMERO</span></div>
            <div>
              <p className="eyebrow">{resultsContent.status}</p>
              <h3>{resultsContent.galleryTitle}</h3>
              <a className="social-button" href={INSTAGRAM_URL} target="_blank" rel="noreferrer"><Instagram size={18} /> {resultsContent.instagramAction} <ArrowUpRight size={17} /></a>
            </div>
          </div>
          <div className="gallery-grid" aria-label="Espacios para casos consentidos antes y después">
            {gallerySlots.map((slot, index) => (
              <article key={`${slot.caseLabel}-${slot.state}`} className={`gallery-slot slot-${index + 1}`}>
                <span>{slot.caseLabel}</span>
                <div><ShieldCheck size={18} /><strong>{slot.state}</strong></div>
                <small>{slot.note}</small>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section id="preguntas" className="faq-section section-wrap">
        <div className="section-heading faq-heading reveal-up">
          <p className="eyebrow">{faqContent.eyebrow}</p>
          <h2>{faqContent.title} <em>{faqContent.accent}</em></h2>
          <p>{faqContent.description}</p>
          <PrimaryLink href={whatsappWithMessage("Hola, tengo una pregunta sobre el procedimiento de retiro de acrocordones.")}>{faqContent.action}</PrimaryLink>
        </div>
        <div className="faq-list reveal-up delay-1">
          {faqContent.items.map((faq, index) => (
            <details key={faq.question} className="faq-item">
              <summary><span>0{index + 1}</span>{faq.question}<ChevronDown size={20} /></summary>
              <p>{faq.answer}</p>
            </details>
          ))}
        </div>
      </section>

      <section id="curso" className="course-section section-wrap">
        <div className="course-noise" />
        <div className="course-copy reveal-up">
          <p className="eyebrow"><GraduationCap size={16} /> {courseContent.eyebrow}</p>
          <h2>{courseContent.title} <em>{courseContent.accent}</em></h2>
          <p>{courseContent.description}</p>
          <div className="course-details">
            <p><span>DIRIGIDO A</span>{courseContent.audience}</p>
            <p><span>MODALIDAD</span>{courseContent.modality}</p>
          </div>
          <PrimaryLink href={courseUrl}>{courseContent.action}</PrimaryLink>
        </div>
        <div className="course-mark reveal-up delay-1" aria-hidden="true">
          <span className="mark-small">MASTERCLASS</span>
          <strong>N</strong>
          <span className="mark-label">NATY<br />STUDIO</span>
        </div>
      </section>

      <section className="testimonials-section section-wrap">
        <div className="testimonial-intro reveal-up">
          <p className="eyebrow">{testimonialContent.eyebrow}</p>
          <h2>{testimonialContent.title} <em>{testimonialContent.accent}</em></h2>
          <p>{testimonialContent.description}</p>
          <a className="text-link" href={whatsappWithMessage("Hola, quiero compartir mi experiencia con naty.studio.")} target="_blank" rel="noreferrer">{testimonialContent.action} <ArrowUpRight size={17} /></a>
        </div>
        <div className="testimonial-card reveal-up delay-1">
          <MessageCircle size={28} />
          <p>{testimonialContent.placeholder}</p>
          <span>— naty.studio</span>
        </div>
      </section>

      <section className="closing-cta section-wrap">
        <p className="eyebrow">{contactContent.eyebrow}</p>
        <h2>{contactContent.title} <em>{contactContent.accent}</em></h2>
        <p>{contactContent.description}</p>
        <PrimaryLink href={bookingUrl}>{contactContent.action}</PrimaryLink>
      </section>

      <footer className="site-footer">
        <div className="footer-top section-wrap">
          <a className="wordmark footer-wordmark" href="#inicio">naty<span>.</span>studio</a>
          <p>{footerContent.description}</p>
          <div className="footer-links">
            <a href={bookingUrl} target="_blank" rel="noreferrer"><MessageCircle size={18} /> WhatsApp</a>
            <a href={INSTAGRAM_URL} target="_blank" rel="noreferrer"><Instagram size={18} /> Instagram</a>
          </div>
        </div>
        <div className="footer-bottom section-wrap">
          <p><MapPin size={15} /> {footerContent.location}</p>
          <p>© {new Date().getFullYear()} naty.studio</p>
        </div>
      </footer>
    </main>
  );
}
