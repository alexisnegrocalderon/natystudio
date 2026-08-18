import { randomBytes } from "node:crypto";
import { neon } from "@neondatabase/serverless";
import { normalizeWhatsApp } from "./nataliaPilot";
import { createNataliaMercadoPagoBrickPayment, getNataliaMercadoPagoBrickConfig, getNataliaMercadoPagoCheckoutStatus } from "./ancPaymentBridge";

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

export type BookingBrickPaymentInput = {
  bookingId: number;
  idempotencyKey: string;
  token: string;
  installments: number;
  paymentMethodId: string;
  issuerId?: string | number;
  payer: { email: string; identification?: { type: string; number: string } };
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

async function materializeWeeklyAvailability() {
  const sql = getSql();
  await sql`
    WITH calendar AS (
      SELECT generate_series(
        date_trunc('day', NOW() AT TIME ZONE 'America/Santiago'),
        date_trunc('day', NOW() AT TIME ZONE 'America/Santiago') + INTERVAL '56 days',
        INTERVAL '1 day'
      )::date AS local_date
    ), candidates AS (
      SELECT
        ((c.local_date::timestamp + make_interval(mins => generated.start_minute)) AT TIME ZONE 'America/Santiago') AS starts_at,
        ((c.local_date::timestamp + make_interval(mins => generated.start_minute + r.slot_duration_minutes)) AT TIME ZONE 'America/Santiago') AS ends_at
      FROM calendar c
      JOIN pilot_weekly_schedule_rules r ON r.weekday = EXTRACT(DOW FROM c.local_date)::smallint AND r.is_enabled = TRUE
      CROSS JOIN LATERAL generate_series(r.starts_minute, r.ends_minute - r.slot_duration_minutes, r.slot_duration_minutes + r.buffer_minutes) AS generated(start_minute)
    )
    INSERT INTO pilot_availability_slots (starts_at, ends_at, status)
    SELECT candidate.starts_at, candidate.ends_at, ${"available"}
    FROM candidates candidate
    WHERE candidate.starts_at > NOW()
      AND NOT EXISTS (
        SELECT 1 FROM pilot_schedule_exceptions exception
        WHERE exception.kind = ${"blocked"} AND candidate.starts_at < exception.ends_at AND candidate.ends_at > exception.starts_at
      )
      AND NOT EXISTS (
        SELECT 1 FROM pilot_availability_slots existing
        WHERE existing.starts_at = candidate.starts_at AND existing.ends_at = candidate.ends_at
      )
  `;
}

export async function listPublicAvailability() {
  await releaseExpiredHolds();
  await materializeWeeklyAvailability();
  const sql = getSql();
  return sql`
    SELECT id, starts_at AS "startsAt", ends_at AS "endsAt"
    FROM pilot_availability_slots
    WHERE status = ${"available"} AND starts_at > NOW()
      AND NOT EXISTS (
        SELECT 1 FROM pilot_schedule_exceptions exception
        WHERE exception.kind = ${"blocked"} AND pilot_availability_slots.starts_at < exception.ends_at AND pilot_availability_slots.ends_at > exception.starts_at
      )
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
    SELECT id, name, payment_mode AS "paymentMode", payment_amount_clp AS "paymentAmountClp"
    FROM pilot_services WHERE slug = ${validated.serviceSlug} AND enabled = TRUE LIMIT 1
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
    const paymentMode = String(service.paymentMode ?? "none");
    const paymentAmountClp = service.paymentAmountClp === null || service.paymentAmountClp === undefined ? null : Number(service.paymentAmountClp);
    const requiresPayment = paymentMode !== "none";
    if (requiresPayment && (paymentAmountClp === null || !Number.isInteger(paymentAmountClp) || paymentAmountClp <= 0)) throw new Error("Este servicio aún no tiene un monto de pago online configurado.");
    const chargedAmount = paymentAmountClp as number | null;
    const [booking] = await sql`
      INSERT INTO pilot_booking_requests (client_id, service_id, availability_slot_id, preferred_date, note, status, idempotency_key)
      VALUES (${Number(client.id)}, ${Number(service.id)}, ${Number(slot.id)}, ${new Date(String(slot.startsAt)).toISOString().slice(0, 10)}, ${validated.note}, ${requiresPayment ? "pending_payment" : "confirmed"}, ${validated.idempotencyKey})
      RETURNING id, status, created_at AS "createdAt"
    `;
    if (!requiresPayment) {
      const [reservedSlot] = await sql`
        UPDATE pilot_availability_slots SET status = ${"booked"}, hold_expires_at = NULL, hold_token = NULL
        WHERE id = ${Number(slot.id)} AND status = ${"held"} AND hold_token = ${validated.holdToken} RETURNING id
      `;
      if (!reservedSlot) throw new Error("No fue posible confirmar el cupo. Inténtalo nuevamente.");
      await sql`INSERT INTO pilot_payment_attempts (booking_id, provider, status, amount_clp) VALUES (${Number(booking.id)}, ${"mercado_pago"}, ${"not_required"}, ${null})`;
      await sql`INSERT INTO pilot_notification_outbox (event_type, payload, delivery_status) VALUES (${"booking.confirmed.staging"}, ${JSON.stringify({ bookingId: booking.id, slotId: slot.id })}::jsonb, ${"blocked"})`;
      return { id: Number(booking.id), status: String(booking.status), createdAt: booking.createdAt, idempotent: false, checkoutUrl: null, paymentRequired: false };
    }

    await sql`INSERT INTO pilot_notification_outbox (event_type, payload, delivery_status) VALUES (${"booking.payment_session_created.staging"}, ${JSON.stringify({ bookingId: booking.id, slotId: slot.id, amountClp: chargedAmount })}::jsonb, ${"blocked"})`;
    return { id: Number(booking.id), status: String(booking.status), createdAt: booking.createdAt, idempotent: false, checkoutUrl: null, paymentRequired: true, paymentSession: { bookingId: Number(booking.id), amountClp: chargedAmount, title: String(service.name), currency: "CLP" } };
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

export async function getPublicBookingBrickConfig(bookingId: number) {
  if (!Number.isInteger(bookingId) || bookingId < 1) throw new Error("La reserva no es válida.");
  const sql = getSql();
  const [booking] = await sql`
    SELECT b.id, b.status, s.name AS "serviceName", s.payment_amount_clp AS "amountClp"
    FROM pilot_booking_requests b JOIN pilot_services s ON s.id = b.service_id
    WHERE b.id = ${bookingId} LIMIT 1
  `;
  if (!booking || String(booking.status) !== "pending_payment") throw new Error("Esta reserva no está disponible para pago online.");
  const amountClp = Number(booking.amountClp);
  if (!Number.isInteger(amountClp) || amountClp <= 0) throw new Error("La reserva no tiene un monto de pago válido.");
  const config = await getNataliaMercadoPagoBrickConfig();
  return { publicKey: config.publicKey, environment: config.environment, marketplace: config.marketplace, amountClp, title: String(booking.serviceName) };
}

export async function processPublicBookingBrickPayment(input: BookingBrickPaymentInput) {
  if (!Number.isInteger(input.bookingId) || input.bookingId < 1) throw new Error("La reserva no es válida.");
  if (!/^[\w-]{12,180}$/.test(input.idempotencyKey)) throw new Error("La referencia de pago no es válida.");
  if (!input.token || input.token.length < 16 || input.token.length > 400) throw new Error("No recibimos un token de pago válido.");
  if (!Number.isInteger(input.installments) || input.installments < 1 || input.installments > 36) throw new Error("Las cuotas no son válidas.");
  if (!input.paymentMethodId?.trim() || !/^\S+@\S+\.\S+$/.test(input.payer?.email ?? "")) throw new Error("Los datos de pago no son válidos.");
  const sql = getSql();
  const [booking] = await sql`
    SELECT b.id, b.status, b.availability_slot_id AS "slotId", s.name AS "serviceName", s.payment_amount_clp AS "amountClp"
    FROM pilot_booking_requests b JOIN pilot_services s ON s.id = b.service_id
    WHERE b.id = ${input.bookingId} LIMIT 1
  `;
  if (!booking || String(booking.status) !== "pending_payment") throw new Error("Esta reserva no está disponible para pago online.");
  const amountClp = Number(booking.amountClp);
  if (!Number.isInteger(amountClp) || amountClp <= 0) throw new Error("La reserva no tiene un monto de pago válido.");
  const externalOrderId = `naty-booking-${booking.id}-${input.idempotencyKey}`;
  const remote = await createNataliaMercadoPagoBrickPayment({
    externalOrderId, title: String(booking.serviceName), unitPrice: String(amountClp), token: input.token, installments: input.installments,
    paymentMethodId: input.paymentMethodId, issuerId: input.issuerId, payer: { email: input.payer.email.trim().toLowerCase(), identification: input.payer.identification },
  });
  await sql`
    INSERT INTO pilot_payment_attempts (booking_id, provider, status, amount_clp, anc_payment_id, anc_checkout_id, idempotency_key, metadata)
    VALUES (${Number(booking.id)}, ${"mercado_pago"}, ${remote.status}, ${amountClp}, ${remote.paymentId}, ${null}, ${externalOrderId}, ${JSON.stringify({ applicationFee: remote.applicationFee, statusDetail: remote.statusDetail, environment: "sandbox" })}::jsonb)
    ON CONFLICT (idempotency_key) WHERE idempotency_key IS NOT NULL
    DO UPDATE SET status = EXCLUDED.status, anc_payment_id = EXCLUDED.anc_payment_id, updated_at = NOW(), metadata = EXCLUDED.metadata
  `;
  if (remote.status === "approved") {
    await sql`UPDATE pilot_booking_requests SET status = ${"confirmed"}, attendance_status = ${"upcoming"} WHERE id = ${Number(booking.id)} AND status = ${"pending_payment"}`;
    await sql`UPDATE pilot_availability_slots SET status = ${"booked"}, hold_token = NULL, hold_expires_at = NULL WHERE id = ${Number(booking.slotId)} AND status IN (${"held"}, ${"available"})`;
    await sql`INSERT INTO pilot_notification_outbox (event_type, payload, delivery_status) VALUES (${"booking.payment_confirmed.staging"}, ${JSON.stringify({ bookingId: booking.id, paymentId: remote.paymentId, externalOrderId })}::jsonb, ${"blocked"})`;
  }
  return { bookingId: Number(booking.id), paymentId: remote.paymentId, paymentStatus: remote.status, paymentStatusDetail: remote.statusDetail, bookingStatus: remote.status === "approved" ? "confirmed" : "pending_payment" };
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

export async function syncNataliaBookingPayment(bookingId: number) {
  if (!Number.isInteger(bookingId) || bookingId < 1) throw new Error("La reserva no es válida.");
  const sql = getSql();
  const [record] = await sql`
    SELECT b.id, b.status, b.availability_slot_id AS "slotId", p.id AS "paymentAttemptId", p.idempotency_key AS "externalOrderId", p.status AS "paymentStatus"
    FROM pilot_booking_requests b
    JOIN LATERAL (SELECT id, idempotency_key, status FROM pilot_payment_attempts WHERE booking_id = b.id ORDER BY id DESC LIMIT 1) p ON TRUE
    WHERE b.id = ${bookingId}
    LIMIT 1
  `;
  if (!record) throw new Error("La reserva no tiene un pago online pendiente.");
  const externalOrderId = String(record.externalOrderId ?? "");
  if (!externalOrderId) throw new Error("La reserva no tiene una orden ANC asociada.");
  const remote = await getNataliaMercadoPagoCheckoutStatus(externalOrderId);
  const paymentStatus = remote.order.status;
  if (paymentStatus === "pending") return { bookingId, paymentStatus: "pending", bookingStatus: String(record.status) };

  if (paymentStatus === "paid") {
    await sql`
      UPDATE pilot_payment_attempts SET status = ${"approved"}, anc_payment_id = ${remote.order.paymentId ?? null}, updated_at = NOW()
      WHERE id = ${Number(record.paymentAttemptId)}
    `;
    await sql`
      UPDATE pilot_booking_requests SET status = ${"confirmed"}, attendance_status = ${"upcoming"}
      WHERE id = ${bookingId} AND status IN (${"pending_payment"}, ${"confirmed"})
    `;
    await sql`
      UPDATE pilot_availability_slots SET status = ${"booked"}, hold_token = NULL, hold_expires_at = NULL
      WHERE id = ${Number(record.slotId)} AND status IN (${"held"}, ${"available"})
    `;
    await sql`
      INSERT INTO pilot_notification_outbox (event_type, payload, delivery_status)
      VALUES (${"booking.payment_confirmed.staging"}, ${JSON.stringify({ bookingId, externalOrderId, paymentId: remote.order.paymentId ?? null })}::jsonb, ${"blocked"})
    `;
    return { bookingId, paymentStatus: "approved", bookingStatus: "confirmed" };
  }

  const localPaymentStatus = paymentStatus === "refunded" ? "refunded" : "cancelled";
  await sql`UPDATE pilot_payment_attempts SET status = ${localPaymentStatus}, anc_payment_id = ${remote.order.paymentId ?? null}, updated_at = NOW() WHERE id = ${Number(record.paymentAttemptId)}`;
  await sql`UPDATE pilot_booking_requests SET status = ${paymentStatus === "refunded" ? "refunded" : "cancelled"}, status_reason = ${`anc_${paymentStatus}`} WHERE id = ${bookingId}`;
  await sql`UPDATE pilot_availability_slots SET status = ${"available"}, hold_token = NULL, hold_expires_at = NULL WHERE id = ${Number(record.slotId)} AND status = ${"held"}`;
  return { bookingId, paymentStatus: localPaymentStatus, bookingStatus: paymentStatus === "refunded" ? "refunded" : "cancelled" };
}
