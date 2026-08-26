"use client";

import { ArrowUpRight, CheckCircle2, Loader2, TriangleAlert } from "lucide-react";
import { useState } from "react";
import { contactFormSchema } from "@naty/shared";
import { trpc } from "@/lib/trpc";

const EMPTY = { name: "", email: "", phone: "", message: "", honeypot: "" };

export function ContactForm() {
  const [form, setForm] = useState(EMPTY);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [sent, setSent] = useState(false);

  const submit = trpc.lead.contact.useMutation({
    onSuccess: () => {
      setSent(true);
      setForm(EMPTY);
    },
    onError: error => setErrors({ form: error.message }),
  });

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    const result = contactFormSchema.safeParse(form);
    if (!result.success) {
      const found: Record<string, string> = {};
      for (const issue of result.error.issues) found[String(issue.path[0])] ??= issue.message;
      setErrors(found);
      return;
    }
    setErrors({});
    submit.mutate(result.data);
  }

  if (sent) {
    return (
      <div className="notice" role="status">
        <CheckCircle2 size={18} />
        <span>Recibimos tu mensaje. Naty te responderá a la brevedad.</span>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} noValidate>
      {/* Campo trampa: invisible para una persona, un bot que rellena todo lo delata. */}
      <input
        type="text"
        name="empresa"
        value={form.honeypot}
        onChange={event => setForm({ ...form, honeypot: event.target.value })}
        tabIndex={-1}
        autoComplete="off"
        aria-hidden="true"
        style={{ position: "absolute", left: "-9999px", width: 0, height: 0 }}
      />

      <div className="field">
        <label htmlFor="contacto-nombre">Nombre</label>
        <input
          id="contacto-nombre"
          value={form.name}
          onChange={event => setForm({ ...form, name: event.target.value })}
        />
        {errors.name ? <p className="field-error">{errors.name}</p> : null}
      </div>

      <div className="field-row">
        <div className="field">
          <label htmlFor="contacto-correo">Correo electrónico</label>
          <input
            id="contacto-correo"
            type="email"
            value={form.email}
            onChange={event => setForm({ ...form, email: event.target.value })}
          />
          {errors.email ? <p className="field-error">{errors.email}</p> : null}
        </div>

        <div className="field">
          <label htmlFor="contacto-telefono">Teléfono (opcional)</label>
          <input
            id="contacto-telefono"
            type="tel"
            placeholder="+56 9 1234 5678"
            value={form.phone}
            onChange={event => setForm({ ...form, phone: event.target.value })}
          />
          {errors.phone ? <p className="field-error">{errors.phone}</p> : null}
        </div>
      </div>

      <div className="field">
        <label htmlFor="contacto-mensaje">Tu mensaje</label>
        <textarea
          id="contacto-mensaje"
          value={form.message}
          onChange={event => setForm({ ...form, message: event.target.value })}
          placeholder="Cuéntanos qué te gustaría evaluar o consultar."
        />
        {errors.message ? <p className="field-error">{errors.message}</p> : null}
      </div>

      {errors.form ? (
        <div className="notice" data-tone="error">
          <TriangleAlert size={18} />
          <span>{errors.form}</span>
        </div>
      ) : null}

      <div className="form-actions">
        <button type="submit" className="primary-link" disabled={submit.isPending}>
          {submit.isPending ? (
            <>
              <Loader2 size={17} className="animate-spin" /> Enviando…
            </>
          ) : (
            <>
              Enviar mensaje <ArrowUpRight size={17} />
            </>
          )}
        </button>
      </div>
    </form>
  );
}
