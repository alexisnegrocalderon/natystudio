import {
  formatBusinessDate,
  formatBusinessTime,
  formatClp,
  formatDuration,
  type EmailJobKind,
} from "@naty/shared";

export type TemplateData = {
  customerName: string;
  serviceName: string;
  startsAt: Date;
  endsAt: Date;
  durationMin: number;
  priceClp: number;
  amountPaidClp: number;
  publicId: string;
  cancelToken: string;
  siteUrl: string;
};

export type RenderedEmail = {
  subject: string;
  html: string;
  text: string;
};

const INK = "#121014";
const PAPER = "#f4eeeb";
const ROSE = "#ea8dac";
const MUTED = "#b8afb4";

function layout(title: string, bodyHtml: string, footerNote?: string): string {
  return `<!doctype html>
<html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${title}</title></head>
<body style="margin:0;padding:0;background:${INK};color:${PAPER};font-family:'Helvetica Neue',Arial,sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${INK};padding:32px 16px;">
    <tr><td align="center">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#1c181d;border-radius:16px;overflow:hidden;">
        <tr><td style="padding:28px 32px 8px;">
          <p style="margin:0;font-size:22px;font-weight:700;letter-spacing:-1px;">naty<span style="color:${ROSE};">.</span>studio</p>
        </td></tr>
        <tr><td style="padding:8px 32px 32px;">
          ${bodyHtml}
        </td></tr>
      </table>
      <p style="max-width:560px;margin:20px auto 0;font-size:12px;line-height:1.6;color:${MUTED};">
        ${footerNote ?? "Enfermera estética · Valparaíso, Chile"}
      </p>
    </td></tr>
  </table>
</body></html>`;
}

function detailRow(label: string, value: string): string {
  return `<tr>
    <td style="padding:8px 0;font-size:12px;letter-spacing:.08em;text-transform:uppercase;color:${MUTED};">${label}</td>
    <td style="padding:8px 0;font-size:15px;font-weight:600;color:${PAPER};text-align:right;">${value}</td>
  </tr>`;
}

function appointmentDetails(data: TemplateData): string {
  const rows = [
    detailRow("Servicio", data.serviceName),
    detailRow("Fecha", formatBusinessDate(data.startsAt)),
    detailRow("Hora", `${formatBusinessTime(data.startsAt)} h`),
    detailRow("Duración", formatDuration(data.durationMin)),
  ];

  if (data.priceClp > 0) {
    rows.push(detailRow("Valor", formatClp(data.priceClp)));
    if (data.amountPaidClp > 0 && data.amountPaidClp < data.priceClp) {
      rows.push(detailRow("Abonado", formatClp(data.amountPaidClp)));
      rows.push(detailRow("Saldo pendiente", formatClp(data.priceClp - data.amountPaidClp)));
    }
  }

  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0"
    style="margin:20px 0;border-top:1px solid rgba(255,243,248,.17);border-bottom:1px solid rgba(255,243,248,.17);">
    ${rows.join("")}
  </table>`;
}

function button(href: string, label: string): string {
  return `<a href="${href}" style="display:inline-block;background:${ROSE};color:#28151c;font-weight:700;font-size:14px;text-decoration:none;padding:13px 22px;border-radius:999px;">${label}</a>`;
}

function heading(text: string): string {
  return `<h1 style="margin:16px 0 12px;font-size:24px;line-height:1.25;font-weight:600;color:${PAPER};">${text}</h1>`;
}

function paragraph(text: string): string {
  return `<p style="margin:0 0 14px;font-size:15px;line-height:1.65;color:${MUTED};">${text}</p>`;
}

function plainDetails(data: TemplateData): string {
  const lines = [
    `Servicio: ${data.serviceName}`,
    `Fecha: ${formatBusinessDate(data.startsAt)}`,
    `Hora: ${formatBusinessTime(data.startsAt)} h`,
    `Duración: ${formatDuration(data.durationMin)}`,
  ];
  if (data.priceClp > 0) lines.push(`Valor: ${formatClp(data.priceClp)}`);
  return lines.join("\n");
}

export function renderEmail(kind: EmailJobKind, data: TemplateData): RenderedEmail {
  const bookingUrl = `${data.siteUrl}/reserva/${data.publicId}`;
  const manageUrl = `${bookingUrl}?token=${data.cancelToken}`;
  const firstName = data.customerName.split(" ")[0];
  const when = `${formatBusinessDate(data.startsAt)} a las ${formatBusinessTime(data.startsAt)} h`;

  switch (kind) {
    case "booking_received":
      return {
        subject: `Recibimos tu solicitud · ${data.serviceName}`,
        html: layout(
          "Solicitud recibida",
          heading(`Hola ${firstName}, recibimos tu solicitud`) +
            paragraph(
              "Naty revisará tu reserva y te confirmará a la brevedad. Todavía no está agendada en firme: te avisaremos por este mismo medio en cuanto quede confirmada.",
            ) +
            appointmentDetails(data) +
            button(manageUrl, "Ver mi reserva"),
        ),
        text: `Hola ${firstName}, recibimos tu solicitud.\n\nNaty la revisará y te confirmará a la brevedad.\n\n${plainDetails(data)}\n\nVer tu reserva: ${manageUrl}`,
      };

    case "booking_confirmed":
      return {
        subject: `Tu cita está confirmada · ${when}`,
        html: layout(
          "Cita confirmada",
          heading(`${firstName}, tu cita quedó confirmada`) +
            paragraph(
              "Te esperamos en Valparaíso. Adjuntamos el evento para que lo agregues a tu calendario y no se te pase.",
            ) +
            appointmentDetails(data) +
            button(manageUrl, "Ver, reagendar o cancelar") +
            paragraph(
              "Si necesitas mover o cancelar la hora, hazlo desde el enlace con la mayor antelación posible.",
            ),
        ),
        text: `${firstName}, tu cita quedó confirmada.\n\n${plainDetails(data)}\n\nGestionar tu reserva: ${manageUrl}`,
      };

    case "reminder_24h":
      return {
        subject: `Mañana es tu cita · ${formatBusinessTime(data.startsAt)} h`,
        html: layout(
          "Recordatorio",
          heading(`${firstName}, mañana te esperamos`) +
            paragraph("Este es el recordatorio de tu cita. Si necesitas moverla, avísanos cuanto antes.") +
            appointmentDetails(data) +
            button(manageUrl, "Ver mi reserva"),
        ),
        text: `${firstName}, mañana es tu cita.\n\n${plainDetails(data)}\n\nVer tu reserva: ${manageUrl}`,
      };

    case "reminder_2h":
      return {
        subject: `Tu cita es hoy a las ${formatBusinessTime(data.startsAt)} h`,
        html: layout(
          "Tu cita es hoy",
          heading(`${firstName}, nos vemos en un rato`) +
            paragraph("Tu cita es hoy. Te recomendamos llegar unos minutos antes.") +
            appointmentDetails(data) +
            button(manageUrl, "Ver mi reserva"),
        ),
        text: `${firstName}, tu cita es hoy a las ${formatBusinessTime(data.startsAt)} h.\n\n${plainDetails(data)}`,
      };

    case "rescheduled":
      return {
        subject: `Cambiamos la hora de tu cita · ${when}`,
        html: layout(
          "Cita reagendada",
          heading(`${firstName}, tu cita cambió de horario`) +
            paragraph("Esta es la nueva fecha y hora. Si no te acomoda, escríbenos y buscamos otra.") +
            appointmentDetails(data) +
            button(manageUrl, "Ver mi reserva"),
        ),
        text: `${firstName}, tu cita cambió de horario.\n\n${plainDetails(data)}\n\nVer tu reserva: ${manageUrl}`,
      };

    case "cancelled":
      return {
        subject: "Tu cita fue cancelada",
        html: layout(
          "Cita cancelada",
          heading(`${firstName}, tu cita fue cancelada`) +
            paragraph(
              `La cita del ${when} ya no está agendada. Si quieres tomar otra hora, puedes hacerlo cuando gustes.`,
            ) +
            button(`${data.siteUrl}/reservar`, "Agendar otra hora"),
        ),
        text: `${firstName}, tu cita del ${when} fue cancelada.\n\nAgendar otra hora: ${data.siteUrl}/reservar`,
      };

    case "admin_new_booking":
      return {
        subject: `Nueva reserva · ${data.customerName} · ${when}`,
        html: layout(
          "Nueva reserva",
          heading("Tienes una nueva reserva") +
            paragraph(`<strong style="color:${PAPER};">${data.customerName}</strong> solicitó una hora.`) +
            appointmentDetails(data) +
            button(`${data.siteUrl}/admin/agenda`, "Abrir la agenda"),
          "Aviso interno de naty.studio",
        ),
        text: `Nueva reserva de ${data.customerName}.\n\n${plainDetails(data)}\n\nAgenda: ${data.siteUrl}/admin/agenda`,
      };

    case "payment_received": {
      const remaining = data.priceClp - data.amountPaidClp;
      const balanceNote =
        remaining > 0
          ? `Queda un saldo de ${formatClp(remaining)} que se paga en el estudio.`
          : "Con esto tu servicio quedó pagado por completo.";

      return {
        subject: `Recibimos tu pago · ${formatClp(data.amountPaidClp)}`,
        html: layout(
          "Pago recibido",
          heading(`${firstName}, recibimos tu pago`) +
            paragraph(`Pagaste ${formatClp(data.amountPaidClp)} y tu hora quedó confirmada. ${balanceNote}`) +
            appointmentDetails(data) +
            button(manageUrl, "Ver mi reserva"),
        ),
        text: `${firstName}, recibimos tu pago de ${formatClp(data.amountPaidClp)}. ${balanceNote}\n\n${plainDetails(data)}\n\nVer tu reserva: ${manageUrl}`,
      };
    }

    case "manual_message":
      // Los mensajes manuales se arman desde `email_jobs.payload` (asunto y
      // cuerpo escritos por Naty), no a partir de una cita: nunca pasan por
      // aquí. Ver `processPendingEmailJobs` en services/email.ts.
      throw new Error("manual_message no se renderiza con renderEmail(); usa email_jobs.payload");
  }
}
