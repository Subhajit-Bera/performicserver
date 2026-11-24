-- 0002_hardening.sql
-- Additive hardening: session store, OAuth one-time codes, contact intake,
-- status history, course offerings, data constraints, updated_at auditing,
-- normalized city lookup, and index corrections.
--
-- This migration intentionally does NOT drop legacy columns; see 0003.

-- ---------------------------------------------------------------------------
-- updated_at auditing
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION set_updated_at() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END $$;

-- Immutable slug helper used by the generated universities.city_slug column.
CREATE OR REPLACE FUNCTION immutable_slug(input text) RETURNS text
LANGUAGE sql IMMUTABLE AS $$
    SELECT NULLIF(
        regexp_replace(
            regexp_replace(lower(coalesce(input, '')), '[^a-z0-9]+', '-', 'g'),
            '(^-+|-+$)', '', 'g'
        ), '');
$$;

DO $$
DECLARE
    tbl text;
BEGIN
    FOREACH tbl IN ARRAY ARRAY['users','universities','courses','exams','partners','streams','applications','appointments']
    LOOP
        EXECUTE format('ALTER TABLE %I ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT now()', tbl);
        EXECUTE format('DROP TRIGGER IF EXISTS %I ON %I', tbl || '_set_updated_at', tbl);
        EXECUTE format(
            'CREATE TRIGGER %I BEFORE UPDATE ON %I FOR EACH ROW EXECUTE FUNCTION set_updated_at()',
            tbl || '_set_updated_at', tbl
        );
    END LOOP;
END $$;

-- ---------------------------------------------------------------------------
-- Sessions: replaces the single raw users.refresh_token value
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token_hash TEXT NOT NULL UNIQUE,
    family_id UUID NOT NULL,
    parent_id UUID REFERENCES sessions(id) ON DELETE SET NULL,
    user_agent TEXT,
    ip_address INET,
    expires_at TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    last_used_at TIMESTAMPTZ,
    revoked_at TIMESTAMPTZ,
    revoked_reason CHARACTER VARYING(60)
);

CREATE INDEX IF NOT EXISTS idx_sessions_user_id ON sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_sessions_family_id ON sessions(family_id);
CREATE INDEX IF NOT EXISTS idx_sessions_active_expiry ON sessions(expires_at) WHERE revoked_at IS NULL;

-- One-time authorization codes used to hand a browser session to the frontend
-- after the Google OAuth redirect.
CREATE TABLE IF NOT EXISTS oauth_codes (
    code CHARACTER VARYING(128) PRIMARY KEY,
    session_id UUID NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    expires_at TIMESTAMPTZ NOT NULL,
    consumed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_oauth_codes_expires ON oauth_codes(expires_at);

-- Public contact form intake (replaces the client-side simulated submission).
CREATE TABLE IF NOT EXISTS contact_messages (
    id SERIAL PRIMARY KEY,
    name CHARACTER VARYING(120) NOT NULL,
    email CHARACTER VARYING(255) NOT NULL,
    phone CHARACTER VARYING(30),
    message TEXT NOT NULL,
    ip_address INET,
    user_agent TEXT,
    handled_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_contact_messages_created_at ON contact_messages(created_at DESC);

-- ---------------------------------------------------------------------------
-- Status history / audit trail
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS application_status_history (
    id SERIAL PRIMARY KEY,
    application_id INTEGER NOT NULL REFERENCES applications(id) ON DELETE CASCADE,
    from_status CHARACTER VARYING(50),
    to_status CHARACTER VARYING(50) NOT NULL,
    changed_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
    note TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_application_history_application ON application_status_history(application_id);

CREATE TABLE IF NOT EXISTS appointment_status_history (
    id SERIAL PRIMARY KEY,
    appointment_id INTEGER NOT NULL REFERENCES appointments(id) ON DELETE CASCADE,
    from_status CHARACTER VARYING(50),
    to_status CHARACTER VARYING(50) NOT NULL,
    changed_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
    note TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_appointment_history_appointment ON appointment_status_history(appointment_id);

-- ---------------------------------------------------------------------------
-- University course offerings: replaces name matching inside JSONB
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS university_course_offerings (
    id SERIAL PRIMARY KEY,
    university_id INTEGER NOT NULL REFERENCES universities(id) ON DELETE CASCADE,
    course_id INTEGER NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
    fee_amount NUMERIC(12, 2) CHECK (fee_amount IS NULL OR fee_amount >= 0),
    fee_currency CHARACTER VARYING(8) NOT NULL DEFAULT 'INR',
    fee_display CHARACTER VARYING(120),
    duration CHARACTER VARYING(80),
    eligibility TEXT,
    admission_year INTEGER,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (university_id, course_id)
);

CREATE INDEX IF NOT EXISTS idx_offerings_course_id ON university_course_offerings(course_id);
CREATE INDEX IF NOT EXISTS idx_offerings_university_id ON university_course_offerings(university_id);

DROP TRIGGER IF EXISTS university_course_offerings_set_updated_at ON university_course_offerings;
CREATE TRIGGER university_course_offerings_set_updated_at
    BEFORE UPDATE ON university_course_offerings
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- Best-effort backfill from the legacy courses_and_fees JSONB.
INSERT INTO university_course_offerings (university_id, course_id, fee_amount, fee_display, duration)
SELECT
    u.id,
    c.id,
    CASE WHEN elem->>'fees' ~ '^[0-9]+(\.[0-9]{1,2})?$' THEN (elem->>'fees')::numeric ELSE NULL END,
    NULLIF(elem->>'fees', ''),
    NULLIF(coalesce(elem->>'duration', elem->>'course_duration'), '')
FROM universities u
CROSS JOIN LATERAL jsonb_array_elements(
    CASE WHEN jsonb_typeof(u.courses_and_fees) = 'array' THEN u.courses_and_fees ELSE '[]'::jsonb END
) AS elem
JOIN courses c ON lower(btrim(c.name)) = lower(btrim(coalesce(elem->>'course', '')))
ON CONFLICT (university_id, course_id) DO NOTHING;

ALTER TABLE applications
    ADD COLUMN IF NOT EXISTS course_offering_id INTEGER REFERENCES university_course_offerings(id) ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS university_name_snapshot CHARACTER VARYING(255),
    ADD COLUMN IF NOT EXISTS updated_by INTEGER REFERENCES users(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_applications_course_offering ON applications(course_offering_id);

-- ---------------------------------------------------------------------------
-- Data constraints
-- ---------------------------------------------------------------------------
UPDATE users SET email = lower(btrim(email)) WHERE email IS DISTINCT FROM lower(btrim(email));

CREATE UNIQUE INDEX IF NOT EXISTS users_email_lower_unique ON users(lower(email));

UPDATE users SET referral_status = 'Not Referred'
WHERE referred_by IS NULL AND referral_status IS DISTINCT FROM 'Not Referred';

DO $$ BEGIN
    ALTER TABLE users ADD CONSTRAINT users_referral_status_check
        CHECK (referral_status IN ('Not Referred', 'Referred', 'Converted'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
    ALTER TABLE users ADD CONSTRAINT users_phone_length_check
        CHECK (phone_number IS NULL OR char_length(phone_number) <= 20);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
    ALTER TABLE universities ADD CONSTRAINT universities_rating_range
        CHECK (rating IS NULL OR (rating >= 0 AND rating <= 5));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
    ALTER TABLE universities ADD CONSTRAINT universities_admission_year_range
        CHECK (admission_year IS NULL OR (admission_year BETWEEN 2000 AND 2100));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
    ALTER TABLE applications ADD CONSTRAINT applications_status_check
        CHECK (status IN ('Applied', 'Called', 'Converted', 'Rejected'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
    ALTER TABLE appointments ADD CONSTRAINT appointments_status_check
        CHECK (status IN ('Booked', 'Called', 'Converted', 'Cancelled', 'Completed', 'No Show'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
    ALTER TABLE appointments ADD CONSTRAINT appointments_notes_length
        CHECK (notes IS NULL OR char_length(notes) <= 1000);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Cancel exact duplicate active bookings so a slot uniqueness index can be added.
WITH duplicates AS (
    SELECT id,
           ROW_NUMBER() OVER (
               PARTITION BY user_id, appointment_date
               ORDER BY id
           ) AS rn
    FROM appointments
    WHERE status = 'Booked'
)
UPDATE appointments a
SET status = 'Cancelled'
FROM duplicates d
WHERE a.id = d.id AND d.rn > 1;

CREATE UNIQUE INDEX IF NOT EXISTS appointments_unique_active_slot
    ON appointments(user_id, appointment_date)
    WHERE status = 'Booked';

-- A stream can only be a "top stream" if the university actually offers it.
DELETE FROM top_university_streams t
WHERE NOT EXISTS (
    SELECT 1 FROM university_streams us
    WHERE us.university_id = t.university_id AND us.stream_id = t.stream_id
);

DO $$ BEGIN
    ALTER TABLE top_university_streams ADD CONSTRAINT top_stream_requires_stream
        FOREIGN KEY (university_id, stream_id)
        REFERENCES university_streams(university_id, stream_id)
        ON DELETE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ---------------------------------------------------------------------------
-- Normalized city lookup for /colleges/[city]/[stream]
-- ---------------------------------------------------------------------------
ALTER TABLE universities
    ADD COLUMN IF NOT EXISTS city_slug CHARACTER VARYING(120)
    GENERATED ALWAYS AS (immutable_slug(split_part(coalesce(location, ''), ',', 1))) STORED;

CREATE INDEX IF NOT EXISTS idx_universities_city_slug ON universities(city_slug);

-- ---------------------------------------------------------------------------
-- Index corrections
-- ---------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_university_streams_stream_id ON university_streams(stream_id);
CREATE INDEX IF NOT EXISTS idx_top_university_streams_stream_id ON top_university_streams(stream_id);
CREATE INDEX IF NOT EXISTS idx_stream_courses_course_id ON stream_courses(course_id);
CREATE INDEX IF NOT EXISTS idx_applications_status ON applications(status);
CREATE INDEX IF NOT EXISTS idx_appointments_status_date ON appointments(status, appointment_date);
CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);
