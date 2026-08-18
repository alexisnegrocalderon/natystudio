-- Agenda curada y lista de espera para el piloto aislado de Natalia.
-- Sólo añade datos de configuración, consentimiento y auditoría; no elimina reservas ni cupos existentes.

CREATE TABLE IF NOT EXISTS pilot_public_booking_settings (
  id smallint PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  public_booking_enabled boolean NOT NULL DEFAULT true,
  booking_window_days integer NOT NULL DEFAULT 14 CHECK (booking_window_days BETWEEN 1 AND 90),
  waitlist_enabled boolean NOT NULL DEFAULT true,
  updated_by_admin_id bigint REFERENCES pilot_admin_users(id),
  updated_at timestamptz NOT NULL DEFAULT now()
);

INSERT INTO pilot_public_booking_settings (id)
VALUES (1)
ON CONFLICT (id) DO NOTHING;

ALTER TABLE pilot_availability_slots
  ADD COLUMN IF NOT EXISTS is_liberated_slot boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS liberated_at timestamptz,
  ADD COLUMN IF NOT EXISTS liberated_by_admin_id bigint REFERENCES pilot_admin_users(id),
  ADD COLUMN IF NOT EXISTS liberation_note text;

CREATE TABLE IF NOT EXISTS pilot_waitlist_entries (
  id bigserial PRIMARY KEY,
  full_name text NOT NULL,
  email text NOT NULL,
  whatsapp text,
  service_id bigint REFERENCES pilot_services(id),
  consent_email boolean NOT NULL DEFAULT false,
  consented_at timestamptz,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'notified', 'booked', 'opted_out', 'archived')),
  priority integer NOT NULL DEFAULT 0,
  admin_note text,
  opted_out_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS pilot_waitlist_notifications (
  id bigserial PRIMARY KEY,
  waitlist_entry_id bigint NOT NULL REFERENCES pilot_waitlist_entries(id) ON DELETE CASCADE,
  slot_id bigint NOT NULL REFERENCES pilot_availability_slots(id) ON DELETE CASCADE,
  channel text NOT NULL DEFAULT 'email' CHECK (channel IN ('email')),
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'queued', 'sent', 'failed', 'cancelled')),
  subject text NOT NULL,
  body_snapshot text NOT NULL,
  provider_message_id text,
  error_message text,
  sent_at timestamptz,
  created_by_admin_id bigint REFERENCES pilot_admin_users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(waitlist_entry_id, slot_id, channel)
);

CREATE TABLE IF NOT EXISTS pilot_agenda_audit (
  id bigserial PRIMARY KEY,
  actor_admin_id bigint REFERENCES pilot_admin_users(id),
  event_type text NOT NULL,
  slot_id bigint REFERENCES pilot_availability_slots(id) ON DELETE SET NULL,
  waitlist_entry_id bigint REFERENCES pilot_waitlist_entries(id) ON DELETE SET NULL,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS pilot_availability_slots_public_window_idx
  ON pilot_availability_slots(status, starts_at)
  WHERE status = 'available';
CREATE INDEX IF NOT EXISTS pilot_waitlist_entries_active_idx
  ON pilot_waitlist_entries(status, consent_email, priority DESC, created_at ASC);
CREATE INDEX IF NOT EXISTS pilot_waitlist_notifications_slot_idx
  ON pilot_waitlist_notifications(slot_id, status, created_at DESC);
CREATE INDEX IF NOT EXISTS pilot_agenda_audit_created_idx
  ON pilot_agenda_audit(created_at DESC);
