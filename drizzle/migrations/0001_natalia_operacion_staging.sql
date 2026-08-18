-- Migración incremental para el piloto aislado de Natalia Rodríguez Studio.
-- Sólo añade capacidades; no elimina ni reescribe datos existentes.

ALTER TABLE pilot_services
  ADD COLUMN IF NOT EXISTS payment_mode text NOT NULL DEFAULT 'none',
  ADD COLUMN IF NOT EXISTS payment_amount_clp integer,
  ADD COLUMN IF NOT EXISTS payment_percentage numeric(5,2),
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'active',
  ADD COLUMN IF NOT EXISTS sort_order integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS preparation_instructions text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS postcare_instructions text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS archived_at timestamptz;

ALTER TABLE pilot_booking_requests
  ADD COLUMN IF NOT EXISTS attendance_status text NOT NULL DEFAULT 'upcoming',
  ADD COLUMN IF NOT EXISTS status_reason text,
  ADD COLUMN IF NOT EXISTS rescheduled_from_booking_id bigint REFERENCES pilot_booking_requests(id),
  ADD COLUMN IF NOT EXISTS rescheduled_at timestamptz,
  ADD COLUMN IF NOT EXISTS payment_required_amount_clp integer,
  ADD COLUMN IF NOT EXISTS currency text NOT NULL DEFAULT 'CLP',
  ADD COLUMN IF NOT EXISTS consented_at timestamptz;

ALTER TABLE pilot_courses
  ADD COLUMN IF NOT EXISTS slug text,
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'draft',
  ADD COLUMN IF NOT EXISTS sort_order integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS instructions text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS materials jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS capacity integer,
  ADD COLUMN IF NOT EXISTS payment_mode text NOT NULL DEFAULT 'full_payment',
  ADD COLUMN IF NOT EXISTS payment_amount_clp integer,
  ADD COLUMN IF NOT EXISTS archived_at timestamptz;

ALTER TABLE pilot_payment_attempts
  ADD COLUMN IF NOT EXISTS course_enrollment_id bigint,
  ADD COLUMN IF NOT EXISTS anc_payment_id text,
  ADD COLUMN IF NOT EXISTS anc_checkout_id text,
  ADD COLUMN IF NOT EXISTS idempotency_key text,
  ADD COLUMN IF NOT EXISTS metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

ALTER TABLE pilot_site_content
  ADD COLUMN IF NOT EXISTS draft_value jsonb,
  ADD COLUMN IF NOT EXISTS publication_status text NOT NULL DEFAULT 'published',
  ADD COLUMN IF NOT EXISTS published_at timestamptz,
  ADD COLUMN IF NOT EXISTS updated_by_admin_id bigint REFERENCES pilot_admin_users(id);

CREATE TABLE IF NOT EXISTS pilot_weekly_schedule_rules (
  id bigserial PRIMARY KEY,
  weekday smallint NOT NULL CHECK (weekday BETWEEN 0 AND 6),
  starts_minute integer NOT NULL CHECK (starts_minute BETWEEN 0 AND 1439),
  ends_minute integer NOT NULL CHECK (ends_minute BETWEEN 1 AND 1440 AND ends_minute > starts_minute),
  slot_duration_minutes integer NOT NULL CHECK (slot_duration_minutes BETWEEN 10 AND 360),
  buffer_minutes integer NOT NULL DEFAULT 0 CHECK (buffer_minutes BETWEEN 0 AND 180),
  is_enabled boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS pilot_schedule_exceptions (
  id bigserial PRIMARY KEY,
  starts_at timestamptz NOT NULL,
  ends_at timestamptz NOT NULL CHECK (ends_at > starts_at),
  kind text NOT NULL DEFAULT 'blocked' CHECK (kind IN ('blocked', 'special_opening')),
  note text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS pilot_booking_audit (
  id bigserial PRIMARY KEY,
  booking_id bigint NOT NULL REFERENCES pilot_booking_requests(id) ON DELETE CASCADE,
  actor_admin_id bigint REFERENCES pilot_admin_users(id),
  event_type text NOT NULL,
  previous_status text,
  next_status text,
  note text,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS pilot_course_enrollments (
  id bigserial PRIMARY KEY,
  course_id bigint NOT NULL REFERENCES pilot_courses(id),
  client_id bigint NOT NULL REFERENCES pilot_clients(id),
  status text NOT NULL DEFAULT 'pending_payment' CHECK (status IN ('pending_payment', 'active', 'cancelled', 'refunded', 'expired')),
  payment_status text NOT NULL DEFAULT 'pending' CHECK (payment_status IN ('pending', 'approved', 'rejected', 'cancelled', 'refunded', 'sandbox')),
  price_snapshot_clp integer,
  currency text NOT NULL DEFAULT 'CLP',
  access_granted_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(course_id, client_id)
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'pilot_payment_attempts_course_enrollment_fk'
  ) THEN
    ALTER TABLE pilot_payment_attempts
      ADD CONSTRAINT pilot_payment_attempts_course_enrollment_fk
      FOREIGN KEY (course_enrollment_id) REFERENCES pilot_course_enrollments(id);
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS pilot_student_access_tokens (
  id bigserial PRIMARY KEY,
  enrollment_id bigint NOT NULL REFERENCES pilot_course_enrollments(id) ON DELETE CASCADE,
  token_hash text NOT NULL UNIQUE,
  expires_at timestamptz NOT NULL,
  used_at timestamptz,
  revoked_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS pilot_site_content_versions (
  id bigserial PRIMARY KEY,
  content_key text NOT NULL,
  content_value jsonb NOT NULL,
  status text NOT NULL CHECK (status IN ('draft', 'published', 'archived')),
  created_by_admin_id bigint REFERENCES pilot_admin_users(id),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS pilot_schedule_rules_weekday_idx ON pilot_weekly_schedule_rules(weekday, is_enabled);
CREATE INDEX IF NOT EXISTS pilot_schedule_exceptions_range_idx ON pilot_schedule_exceptions(starts_at, ends_at);
CREATE INDEX IF NOT EXISTS pilot_booking_audit_booking_idx ON pilot_booking_audit(booking_id, created_at DESC);
CREATE INDEX IF NOT EXISTS pilot_course_enrollments_course_idx ON pilot_course_enrollments(course_id, status);
CREATE INDEX IF NOT EXISTS pilot_course_enrollments_client_idx ON pilot_course_enrollments(client_id, created_at DESC);
CREATE UNIQUE INDEX IF NOT EXISTS pilot_courses_slug_unique ON pilot_courses(slug) WHERE slug IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS pilot_payment_attempts_idempotency_unique ON pilot_payment_attempts(idempotency_key) WHERE idempotency_key IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS pilot_payment_attempts_anc_payment_unique ON pilot_payment_attempts(anc_payment_id) WHERE anc_payment_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS pilot_site_content_versions_key_idx ON pilot_site_content_versions(content_key, created_at DESC);
