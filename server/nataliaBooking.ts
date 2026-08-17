import { randomBytes } from "node:crypto";
import { neon } from "@neondatabase/serverless";
import { normalizeWhatsApp } from "./nataliaPilot";

const HOLD_MINUTES = 15;

export type SlotHoldInput = { slotId: number };
export type BookingConfirmationInput = {
  holdToken: string;
  serviceSlug: string;
  fullName: string;
  email: string;
  whatsapp: string;
  note?: string;
  idempotencyKey: string;
};

function getSql() {
  const connectionString = process.env.NEON_DATABASE_URL;
  if (!connectionString) throw new Error("La conexión Neon del piloto no está configurada.");
  return neon(connectionString);
}

function requiredText(value: string, label: string, maxLength: number) {
  const normalized = value.trim();
  if (!normalized || normalized.length > maxLength) throw new Error(`${label} no es válido.`);
  return normalized;
}

export function validateBookingConfirmation(input: BookingConfirmationInput) {
  const email = requiredText(input.email, "El correo", 180).toLowerCase();
  if (!/^\S+@\S+\.\S+$/.test(email)) throw new Error("El correo no es válido.");
  const whatsapp = normalizeWhatsApp(requiredText(input.whatsapp, "El teléfono", 40));
  if (whatsapp.replace(/\D/g, "").length < 8) throw new Error("El teléfono no es válido.");
  return {
    holdToken: requiredText(input.holdToken, "La retención", 180),
    serviceSlug: requiredText(input.serviceSlug, "El servicio", 80),
    fullName: requiredText(input.fullName, "El nombre", 160),
    email,
    whatsapp,
    note: input.note?.trim().slice(0, 1_000) || null,
    idempotencyKey: requiredText(input.idempotencyKey, "La referencia", 180),
  };
}

async function releaseExpiredHolds() {
  const sql = getSql();
  await sql`
    UPDATE pilot_availability_slots
    SET status = ${"available"}, hold_expires_at = NULL, hold_token = NULL
    WHERE status = ${"held"} AND hold_expires_at <= NOW()
  `;
}

export async function listPublicAvailability() {
  await releaseExpiredHolds();
  const sql = getSql();
  return sql`
    SELECT id, starts_at AS "startsAt", ends_at AS "endsAt"
    FROM pilot_availability_slots
    WHERE status = ${"available"} AND starts_at > NOW()
    ORDER BY starts_at ASC
    LIMIT 80
  `;
}

export async function holdPublicAvailability(input: SlotHoldInput) {
  if (!Number.isInteger(input.slotId) || input.slotId < 1) throw new Error("El horario no es válido.");
  await releaseExpiredHolds();
  const sql = getSql();
  const holdToken = randomBytes(24).toString("base64url");
  const holdExpiresAt = new Date(Date.now() + HOLD_MINUTES * 60 * 1000).toISOString();
  const [slot] = await sql`
    UPDATE pilot_availability_slots
    SET status = ${"held"}, hold_token = ${holdToken}, hold_expires_at = ${holdExpiresAt}
    WHERE id = ${input.slotId} AND status = ${"available"} AND starts_at > NOW()
    RETURNING id, starts_at AS "startsAt", ends_at AS "endsAt", hold_expires_at AS "holdExpiresAt"
  `;
  if (!slot) throw new Error("Ese horario ya no está disponible. Elige otro cupo.");
  return { id: Number(slot.id), startsAt: slot.startsAt, endsAt: slot.endsAt, holdToken, holdExpiresAt: slot.holdExpiresAt };
}

export async function confirmSimulatedBooking(input: BookingConfirmationInput) {
  const validated = validateBookingConfirmation(input);
  const sql = getSql();
  const [existing] = await sql`
    SELECT id, status, created_at AS "createdAt"
    FROM pilot_booking_requests
    WHERE idempotency_key = ${validated.idempotencyKey}
    LIMIT 1
  `;
  if (existing) return { id: Number(existing.id), status: String(existing.status), createdAt: existing.createdAt, idempotent: true };

  const [service] = await sql`
    SELECT id FROM pilot_services WHERE slug = ${validated.serviceSlug} AND enabled = TRUE LIMIT 1
  `;
  if (!service) throw new Error("El servicio seleccionado ya no está disponible.");
  const [slot] = await sql`
    SELECT id, starts_at AS "startsAt"
    FROM pilot_availability_slots
    WHERE hold_token = ${validated.holdToken} AND status = ${"held"} AND hold_expires_at > NOW()
    LIMIT 1
  `;
  if (!slot) throw new Error("La retención venció. Elige otro horario para continuar.");

  const [client] = await sql`
    INSERT INTO pilot_clients (full_name, whatsapp, email)
    VALUES (${validated.fullName}, ${validated.whatsapp}, ${validated.email})
    ON CONFLICT (whatsapp)
    DO UPDATE SET full_name = EXCLUDED.full_name, email = EXCLUDED.email
    RETURNING id
  `;
  try {
    const [booking] = await sql`
      INSERT INTO pilot_booking_requests (client_id, service_id, availability_slot_id, preferred_date, note, status, idempotency_key)
      VALUES (${Number(client.id)}, ${Number(service.id)}, ${Number(slot.id)}, ${new Date(String(slot.startsAt)).toISOString().slice(0, 10)}, ${validated.note}, ${"confirmed"}, ${validated.idempotencyKey})
      RETURNING id, status, created_at AS "createdAt"
    `;
    const [reservedSlot] = await sql`
      UPDATE pilot_availability_slots
      SET status = ${"booked"}, hold_expires_at = NULL, hold_token = NULL
      WHERE id = ${Number(slot.id)} AND status = ${"held"} AND hold_token = ${validated.holdToken}
      RETURNING id
    `;
    if (!reservedSlot) throw new Error("No fue posible confirmar el cupo. Inténtalo nuevamente.");
    await sql`
      INSERT INTO pilot_payment_attempts (booking_id, provider, status, amount_clp)
      VALUES (${Number(booking.id)}, ${"mercado_pago"}, ${"simulated"}, ${null})
    `;
    await sql`
      INSERT INTO pilot_notification_outbox (event_type, payload, delivery_status)
      VALUES (${"booking.confirmed.staging"}, ${JSON.stringify({ bookingId: booking.id, slotId: slot.id })}::jsonb, ${"blocked"})
    `;
    return { id: Number(booking.id), status: String(booking.status), createdAt: booking.createdAt, idempotent: false };
  } catch (error) {
    const [retried] = await sql`
      SELECT id, status, created_at AS "createdAt"
      FROM pilot_booking_requests
      WHERE idempotency_key = ${validated.idempotencyKey}
      LIMIT 1
    `;
    if (retried) return { id: Number(retried.id), status: String(retried.status), createdAt: retried.createdAt, idempotent: true };
    throw error;
  }
}

export async function listNataliaBookings(input: { limit?: number; offset?: number } = {}) {
  const limit = Math.min(Math.max(Math.floor(input.limit ?? 50), 1), 100);
  const offset = Math.max(Math.floor(input.offset ?? 0), 0);
  const sql = getSql();
  return sql`
    SELECT b.id, b.status, b.created_at AS "createdAt", c.full_name AS "fullName", c.email, c.whatsapp,
      s.name AS "serviceName", a.starts_at AS "startsAt", p.status AS "paymentStatus"
    FROM pilot_booking_requests b
    JOIN pilot_clients c ON c.id = b.client_id
    JOIN pilot_services s ON s.id = b.service_id
    LEFT JOIN pilot_availability_slots a ON a.id = b.availability_slot_id
    LEFT JOIN LATERAL (
      SELECT status FROM pilot_payment_attempts WHERE booking_id = b.id ORDER BY id DESC LIMIT 1
    ) p ON TRUE
    ORDER BY b.created_at DESC
    LIMIT ${limit}
    OFFSET ${offset}
  `;
}

export async function countNataliaBookings() {
  const sql = getSql();
  const [result] = await sql`SELECT COUNT(*)::int AS total FROM pilot_booking_requests`;
  return Number(result?.total ?? 0);
}
