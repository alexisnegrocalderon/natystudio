/** Plantillas de WhatsApp que el panel ofrece para escribirle a una clienta. */

function firstName(fullName: string): string {
  return fullName.trim().split(" ")[0] || fullName;
}

export const whatsappTemplates = [
  {
    label: "Recordatorio de hora",
    build: (name: string) =>
      `Hola ${firstName(name)}, te escribo de naty.studio para recordarte tu hora. ¿Sigue en pie?`,
  },
  {
    label: "Seguimiento post-consulta",
    build: (name: string) =>
      `Hola ${firstName(name)}, ¿cómo has estado luego de tu sesión? Cualquier duda, aquí estoy.`,
  },
  {
    label: "Retomar reserva abandonada",
    build: (name: string) =>
      `Hola ${firstName(name)}, vi que empezaste a reservar tu hora en naty.studio y no alcanzaste a terminar. ¿Te ayudo a agendarla?`,
  },
] as const;
