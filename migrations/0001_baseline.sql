-- 0001_baseline.sql
-- Baseline schema for a fresh database. Idempotent so it is a no-op against the
-- existing performic-db where these objects already exist.

DO $$ BEGIN
    CREATE TYPE user_role AS ENUM ('user', 'admin', 'agent');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

CREATE TABLE IF NOT EXISTS streams (
    id SERIAL PRIMARY KEY,
    name CHARACTER VARYING(100) NOT NULL UNIQUE,
    slug CHARACTER VARYING(100) NOT NULL UNIQUE
);

CREATE TABLE IF NOT EXISTS universities (
    id SERIAL PRIMARY KEY,
    name CHARACTER VARYING(255) NOT NULL,
    slug CHARACTER VARYING(255) NOT NULL UNIQUE,
    location CHARACTER VARYING(255),
    image_url TEXT,
    rating NUMERIC(2, 1) DEFAULT 0.0,
    description TEXT,
    details JSONB,
    courses_and_fees JSONB,
    placements JSONB,
    facilities TEXT[],
    admission_open BOOLEAN DEFAULT FALSE,
    admission_year INTEGER,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    is_top_university BOOLEAN DEFAULT FALSE
);

CREATE TABLE IF NOT EXISTS courses (
    id SERIAL PRIMARY KEY,
    name CHARACTER VARYING(100) NOT NULL,
    slug CHARACTER VARYING(100) NOT NULL UNIQUE,
    description TEXT,
    icon_name CHARACTER VARYING(50),
    related_university_ids INTEGER[]
);

CREATE TABLE IF NOT EXISTS exams (
    id SERIAL PRIMARY KEY,
    name CHARACTER VARYING(100) NOT NULL,
    slug CHARACTER VARYING(100) NOT NULL UNIQUE,
    exam_date CHARACTER VARYING(100),
    exam_level CHARACTER VARYING(100),
    info JSONB,
    application_form JSONB,
    important_dates JSONB,
    syllabus JSONB,
    exam_pattern JSONB,
    admit_card_details TEXT,
    result_details TEXT,
    cutoff_details TEXT
);

CREATE TABLE IF NOT EXISTS partners (
    id SERIAL PRIMARY KEY,
    name CHARACTER VARYING(100) NOT NULL,
    location CHARACTER VARYING(100),
    featured_text CHARACTER VARYING(255),
    logo_url TEXT,
    link_stream_slug CHARACTER VARYING(100),
    link_city_slug CHARACTER VARYING(100)
);

CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    google_id CHARACTER VARYING(255) UNIQUE,
    full_name CHARACTER VARYING(100) NOT NULL,
    email CHARACTER VARYING(255) NOT NULL UNIQUE,
    password_hash CHARACTER VARYING(255),
    role user_role DEFAULT 'user'::user_role NOT NULL,
    refresh_token TEXT,
    phone_number CHARACTER VARYING(20),
    whatsapp_number CHARACTER VARYING(20),
    state_hometown CHARACTER VARYING(100),
    choice_of_stream CHARACTER VARYING(100),
    choice_of_stream_other CHARACTER VARYING(100),
    entry_level CHARACTER VARYING(100),
    entry_level_other CHARACTER VARYING(100),
    how_heard CHARACTER VARYING(100),
    how_heard_other CHARACTER VARYING(100),
    referred_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
    referral_status CHARACTER VARYING(50) DEFAULT 'Not Referred',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS university_streams (
    university_id INTEGER NOT NULL REFERENCES universities(id) ON DELETE CASCADE,
    stream_id INTEGER NOT NULL REFERENCES streams(id) ON DELETE CASCADE,
    PRIMARY KEY (university_id, stream_id)
);

CREATE TABLE IF NOT EXISTS top_university_streams (
    university_id INTEGER NOT NULL REFERENCES universities(id) ON DELETE CASCADE,
    stream_id INTEGER NOT NULL REFERENCES streams(id) ON DELETE CASCADE,
    PRIMARY KEY (university_id, stream_id)
);

CREATE TABLE IF NOT EXISTS stream_courses (
    stream_id INTEGER NOT NULL REFERENCES streams(id) ON DELETE CASCADE,
    course_id INTEGER NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
    PRIMARY KEY (stream_id, course_id)
);

CREATE TABLE IF NOT EXISTS applications (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    university_id INTEGER NOT NULL REFERENCES universities(id) ON DELETE CASCADE,
    course_name CHARACTER VARYING(255),
    status CHARACTER VARYING(50) DEFAULT 'Applied' NOT NULL,
    applied_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT applications_user_id_university_id_key UNIQUE (user_id, university_id)
);

CREATE TABLE IF NOT EXISTS appointments (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    appointment_date TIMESTAMP WITH TIME ZONE NOT NULL,
    notes TEXT,
    status CHARACTER VARYING(50) DEFAULT 'Booked' NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_users_refresh_token ON users(refresh_token);
CREATE INDEX IF NOT EXISTS idx_users_referred_by ON users(referred_by);
CREATE INDEX IF NOT EXISTS idx_appointments_user_id ON appointments(user_id);
CREATE INDEX IF NOT EXISTS idx_appointments_date ON appointments(appointment_date);
CREATE INDEX IF NOT EXISTS idx_universities_top_rating ON universities(is_top_university, rating DESC);
CREATE INDEX IF NOT EXISTS idx_applications_university_id ON applications(university_id);
CREATE INDEX IF NOT EXISTS idx_applications_user_id ON applications(user_id);
CREATE INDEX IF NOT EXISTS idx_universities_courses_and_fees ON universities USING gin (courses_and_fees);
CREATE INDEX IF NOT EXISTS idx_exams_info ON exams USING gin (info);
