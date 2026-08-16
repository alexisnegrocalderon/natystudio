export const languages = ["ES", "PT", "EN"] as const;
export type Language = (typeof languages)[number];

export const aboutContent = {
  paragraphs: [
    "Como enfermera estética, combino conocimiento profesional con una atención cálida y simple. Mi objetivo es que entiendas cada paso y que te sientas acompañada desde la primera conversación.",
    "Me especializo en el retiro de acrocordones y también comparto mi experiencia con profesionales de la salud y la estética que quieren profundizar su práctica.",
  ],
  points: [
    "Evaluación y orientación individualizada.",
    "Indicaciones claras de cuidado posterior.",
    "Atención en Valparaíso para pacientes y profesionales.",
  ],
};

export const serviceContent = {
  title: "Retiro de acrocordones",
  description: "Atención enfocada en la evaluación y retiro seguro de acrocordones, con indicaciones personalizadas para tu proceso.",
  value: "Consulta y cotiza por WhatsApp",
  duration: "Según evaluación de tu caso",
};

export const gallerySlots = [
  { caseLabel: "Caso 01", state: "Antes", note: "Espacio para imagen con autorización." },
  { caseLabel: "Caso 01", state: "Después", note: "Espacio para imagen con autorización." },
  { caseLabel: "Nuevo caso", state: "Consentimiento", note: "Material clínico pendiente de publicación." },
];

export const navItems = [
  ["Servicios", "#servicios"],
  ["Sobre Naty", "#sobre-mi"],
  ["Resultados", "#resultados"],
  ["Curso", "#curso"],
  ["Preguntas", "#preguntas"],
] as const;

export const heroContent = {
  eyebrow: "Enfermera estética · Valparaíso, Chile",
  title: "Cuidado experto,",
  accent: "piel en calma.",
  lede: "Especialista en retiro de acrocordones, con una atención cercana, informada y cuidadosamente personalizada.",
  primaryAction: "Agendar una evaluación",
  secondaryAction: "Aprende con Naty",
  trust: "Tu atención comienza con una evaluación responsable y orientación clara para tu caso.",
  visualNote: "Atención personalizada",
  location: "Valparaíso",
  portraitCaption: "Naty · Enfermera estética",
};

export const authorityContent = [
  { title: "Formación de enfermería", description: "Una mirada cuidadosa para cada atención." },
  { title: "Técnica y orientación", description: "Información clara antes y después del procedimiento." },
  { title: "Formación profesional", description: "Conocimiento para quienes quieren seguir creciendo." },
];

export const servicesSectionContent = {
  eyebrow: "Atención presencial",
  title: "Un espacio para",
  accent: "sentirte bien en tu piel.",
  description: "Recibe una atención personalizada en Valparaíso, centrada en la evaluación, seguridad y cuidado de tu piel.",
  action: "Quiero agendar",
};

export const aboutSectionContent = {
  eyebrow: "Sobre Naty",
  title: "Mi forma de atender empieza por",
  accent: "escucharte.",
  graphic: "Estética con",
  graphicAccent: "criterio y cercanía.",
  action: "Conversemos por WhatsApp",
};

export const resultsContent = {
  eyebrow: "Resultados y privacidad",
  title: "Historias reales,",
  accent: "compartidas con respeto.",
  description: "La galería de casos se publica exclusivamente con autorización. Mientras se incorporan imágenes clínicas consentidas al sitio, puedes conocer el trabajo de Naty en Instagram.",
  status: "Galería en actualización",
  galleryTitle: "Casos antes y después con consentimiento informado.",
  instagramAction: "Ver Instagram",
};

export const faqContent = {
  eyebrow: "Resolvemos tus dudas",
  title: "Preguntas antes de tu",
  accent: "atención.",
  description: "Si tu pregunta no está aquí, escríbenos directamente. Te orientaremos antes de reservar.",
  action: "Hacer una consulta",
  items: [
    { question: "¿Qué son los acrocordones?", answer: "Son pequeñas lesiones cutáneas benignas que pueden aparecer, entre otras zonas, en cuello, axilas o párpados. La evaluación previa permite orientar el procedimiento más adecuado para cada caso." },
    { question: "¿El procedimiento es seguro?", answer: "La seguridad comienza con una evaluación responsable, indicaciones claras y una técnica realizada por una profesional capacitada. Si tu caso requiere evaluación médica adicional, se te orientará antes de avanzar." },
    { question: "¿Qué cuidados debo tener después?", answer: "Recibirás indicaciones personalizadas según la zona tratada. En general, es importante mantener el área limpia, evitar manipularla y seguir las recomendaciones entregadas durante tu atención." },
    { question: "¿Cómo sé si este servicio es para mí?", answer: "Escríbenos por WhatsApp con una breve descripción de lo que deseas evaluar. Naty te orientará respecto de los próximos pasos y la disponibilidad para una atención presencial en Valparaíso." },
  ],
};

export const courseContent = {
  eyebrow: "Aprende con Naty",
  title: "Tu experiencia también puede",
  accent: "enseñar.",
  description: "Un espacio de formación para profesionales de salud y estética que buscan conocer la técnica, los criterios de atención y el enfoque práctico detrás del retiro de acrocordones.",
  audience: "Profesionales de salud y estética.",
  modality: "Información y próximas fechas por WhatsApp.",
  action: "Quiero información del curso",
};

export const testimonialContent = {
  eyebrow: "Experiencias verificadas",
  title: "Tu confianza",
  accent: "no se inventa.",
  description: "Esta sección está reservada para opiniones reales de pacientes, compartidas con su autorización. Si ya te atendiste con Naty, puedes dejar tu experiencia directamente por WhatsApp.",
  action: "Compartir mi experiencia",
  placeholder: "Próximamente encontrarás aquí testimonios auténticos y autorizados de pacientes.",
};

export const contactContent = {
  eyebrow: "¿Hablamos?",
  title: "Empecemos por una",
  accent: "conversación.",
  description: "Escríbenos para conocer disponibilidad, resolver tus preguntas o recibir información del curso.",
  action: "Escribir por WhatsApp",
};

export const footerContent = {
  description: "Enfermera estética especializada en retiro de acrocordones y formación profesional.",
  location: "Valparaíso, Chile",
};
