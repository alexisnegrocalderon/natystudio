import { neon } from "@neondatabase/serverless";

export type BookingInput = {
  fullName: string;
  whatsapp: string;
  serviceSlug: string;
  preferredDate?: string;
  note?: string;
};

export type PilotServiceSummary = {
  slug: string;
  name: string;
  description: string;
  priceNote: string;
  durationNote: string;
};

function getSql() {
  const connectionString = process.env.NEON_DATABASE_URL;
  if (!connectionString) {
    throw new Error("La conexión Neon del piloto no está configurada.");
  }
  return neon(connectionString);
}

export function normalizeWhatsApp(value: string) {
  return value.replace(/[^\d+]/g, "").replace(/^00/, "+");
}

export async function listPilotServices(): Promise<PilotServiceSummary[]> {
  const sql = getSql();
  const rows = await sql`
    SELECT slug, name, description, price_note AS "priceNote", duration_note AS "durationNote"
    FROM pilot_services
    WHERE enabled = TRUE
    ORDER BY id ASC
  `;
  return rows.map((row) => ({
    slug: String(row.slug),
    name: String(row.name),
    description: String(row.description),
    priceNote: String(row.priceNote),
    durationNote: String(row.durationNote),
  }));
}

export async function createPilotBooking(input: BookingInput) {
  const sql = getSql();
  const whatsapp = normalizeWhatsApp(input.whatsapp);

  const serviceRows = await sql`
    SELECT id
    FROM pilot_services
    WHERE slug = ${input.serviceSlug} AND enabled = TRUE
    LIMIT 1
  `;
  const serviceId = Number(serviceRows[0]?.id);
  if (!serviceId) {
    throw new Error("El servicio solicitado no está disponible.");
  }

  const clientRows = await sql`
    INSERT INTO pilot_clients (full_name, whatsapp)
    VALUES (${input.fullName}, ${whatsapp})
    ON CONFLICT (whatsapp)
    DO UPDATE SET full_name = EXCLUDED.full_name
    RETURNING id
  `;
  const clientId = Number(clientRows[0]?.id);

  const bookingRows = await sql`
    INSERT INTO pilot_booking_requests (client_id, service_id, preferred_date, note)
    VALUES (${clientId}, ${serviceId}, ${input.preferredDate ?? null}, ${input.note ?? null})
    RETURNING id, status, created_at AS "createdAt"
  `;
  const booking = bookingRows[0];

  await sql`
    INSERT INTO pilot_notification_outbox (event_type, payload, delivery_status)
    VALUES (
      ${"booking.requested"},
      ${JSON.stringify({ bookingId: booking?.id, clientId, serviceId })}::jsonb,
      ${"blocked"}
    )
  `;

  return {
    id: Number(booking?.id),
    status: String(booking?.status),
    createdAt: booking?.createdAt,
  };
}

export async function getPilotOverview() {
  const sql = getSql();
  const [summary] = await sql`
    SELECT
      (SELECT COUNT(*)::int FROM pilot_services WHERE enabled = TRUE) AS "activeServices",
      (SELECT COUNT(*)::int FROM pilot_clients) AS "clientCount",
      (SELECT COUNT(*)::int FROM pilot_booking_requests WHERE status = 'pending') AS "pendingBookings",
      (SELECT COUNT(*)::int FROM pilot_notification_outbox WHERE delivery_status = 'blocked') AS "blockedNotifications"
  `;

  return {
    activeServices: Number(summary?.activeServices ?? 0),
    clientCount: Number(summary?.clientCount ?? 0),
    pendingBookings: Number(summary?.pendingBookings ?? 0),
    blockedNotifications: Number(summary?.blockedNotifications ?? 0),
    integrations: {
      mailing: "manual_required",
      payments: "blocked",
      whatsapp: "blocked",
    },
  };
}
