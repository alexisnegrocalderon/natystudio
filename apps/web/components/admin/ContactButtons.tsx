"use client";

import { Mail, MessageCircle, Phone } from "lucide-react";
import { whatsappTo } from "@/lib/site";

/** WhatsApp, llamar y correo de una clienta, como botones grandes para el pulgar. */
export function ContactButtons({
  name,
  phone,
  email,
  message,
  withEmail = false,
}: {
  name: string;
  phone?: string | null;
  email?: string | null;
  /** Texto con que se abre el chat de WhatsApp. */
  message?: string;
  withEmail?: boolean;
}) {
  const firstName = name.split(" ")[0] || name;
  const text = message ?? `Hola ${firstName}, te escribo de Natalia Rodríguez Studio.`;
  return (
    <>
      {phone ? (
        <a className="admin-action" data-variant="whatsapp" href={whatsappTo(phone, text)} target="_blank" rel="noreferrer">
          <MessageCircle size={15} aria-hidden="true" /> WhatsApp
        </a>
      ) : null}
      {phone ? (
        <a className="admin-action" href={`tel:${phone.replace(/[^\d+]/g, "")}`}>
          <Phone size={15} aria-hidden="true" /> Llamar
        </a>
      ) : null}
      {withEmail && email ? (
        <a className="admin-action" href={`mailto:${email}`}>
          <Mail size={15} aria-hidden="true" /> Correo
        </a>
      ) : null}
    </>
  );
}
