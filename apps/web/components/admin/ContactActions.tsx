"use client";

import { Loader2, Mail, MessageCircle, Send, X } from "lucide-react";
import { useState } from "react";
import { whatsappTemplates } from "@/lib/messageTemplates";
import { whatsappTo } from "@/lib/site";

export function ContactActions({
  name,
  phone,
  onSendEmail,
  sending,
}: {
  name: string;
  phone?: string | null;
  onSendEmail: (subject: string, body: string) => void;
  sending: boolean;
}) {
  const [composing, setComposing] = useState(false);
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");

  function submit() {
    if (!subject.trim() || !body.trim()) return;
    onSendEmail(subject.trim(), body.trim());
    setComposing(false);
    setSubject("");
    setBody("");
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: ".8rem" }}>
      <div style={{ display: "flex", flexWrap: "wrap", gap: ".5rem" }}>
        {phone
          ? whatsappTemplates.map(template => (
              <a
                key={template.label}
                className="mini-button"
                href={whatsappTo(phone, template.build(name))}
                target="_blank"
                rel="noreferrer"
              >
                <MessageCircle size={13} /> {template.label}
              </a>
            ))
          : null}

        {!composing ? (
          <button type="button" className="mini-button" onClick={() => setComposing(true)}>
            <Mail size={13} /> Enviar correo
          </button>
        ) : null}
      </div>

      {composing ? (
        <div className="admin-card" style={{ margin: 0 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <h2>Correo directo</h2>
            <button type="button" className="mini-button" onClick={() => setComposing(false)}>
              <X size={13} />
            </button>
          </div>

          <div className="field">
            <label htmlFor="asunto-correo">Asunto</label>
            <input id="asunto-correo" value={subject} onChange={event => setSubject(event.target.value)} />
          </div>

          <div className="field">
            <label htmlFor="cuerpo-correo">Mensaje</label>
            <textarea id="cuerpo-correo" value={body} onChange={event => setBody(event.target.value)} />
          </div>

          <button type="button" className="primary-link" onClick={submit} disabled={sending}>
            {sending ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
            Enviar
          </button>
        </div>
      ) : null}
    </div>
  );
}
