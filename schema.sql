-- ==============================================================================
-- PerFormic -- complete current database schema (PostgreSQL 17)
-- Generated with:  pg_dump --schema-only --no-owner --no-privileges
-- from a fully migrated database (0001_baseline .. 0004_timestamps applied).
--
-- The source of truth is the migrations/ directory, applied by `npm run migrate`.
-- This file is a read-only reference for what the final schema looks like; use it
-- to bootstrap a brand new database in one shot instead of running the migrations.
-- ==============================================================================

--
-- PostgreSQL database dump
--

\restrict OCMahWsQUf3yufKbpcRX7HpI3s5jmj2x2d9hoMcE1j4lGvEFV3jM47DCFxtEO1q

-- Dumped from database version 17.6
-- Dumped by pg_dump version 17.6

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET transaction_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Name: user_role; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.user_role AS ENUM (
    'user',
    'admin',
    'agent'
);


--
-- Name: immutable_slug(text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.immutable_slug(input text) RETURNS text
    LANGUAGE sql IMMUTABLE
    AS $_$
    SELECT NULLIF(
        regexp_replace(
            regexp_replace(lower(coalesce(input, '')), '[^a-z0-9]+', '-', 'g'),
            '(^-+|-+$)', '', 'g'
        ), '');
$_$;


--
-- Name: set_updated_at(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.set_updated_at() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END $$;


SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: application_status_history; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.application_status_history (
    id integer NOT NULL,
    application_id integer NOT NULL,
    from_status character varying(50),
    to_status character varying(50) NOT NULL,
    changed_by integer,
    note text,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: application_status_history_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.application_status_history_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: application_status_history_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.application_status_history_id_seq OWNED BY public.application_status_history.id;


--
-- Name: applications; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.applications (
    id integer NOT NULL,
    user_id integer NOT NULL,
    university_id integer NOT NULL,
    course_name character varying(255),
    status character varying(50) DEFAULT 'Applied'::character varying NOT NULL,
    applied_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    course_offering_id integer,
    university_name_snapshot character varying(255),
    updated_by integer,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT applications_status_check CHECK (((status)::text = ANY ((ARRAY['Applied'::character varying, 'Called'::character varying, 'Converted'::character varying, 'Rejected'::character varying])::text[])))
);


--
-- Name: applications_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.applications_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: applications_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.applications_id_seq OWNED BY public.applications.id;


--
-- Name: appointment_status_history; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.appointment_status_history (
    id integer NOT NULL,
    appointment_id integer NOT NULL,
    from_status character varying(50),
    to_status character varying(50) NOT NULL,
    changed_by integer,
    note text,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: appointment_status_history_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.appointment_status_history_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: appointment_status_history_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.appointment_status_history_id_seq OWNED BY public.appointment_status_history.id;


--
-- Name: appointments; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.appointments (
    id integer NOT NULL,
    user_id integer NOT NULL,
    appointment_date timestamp with time zone NOT NULL,
    notes text,
    status character varying(50) DEFAULT 'Booked'::character varying NOT NULL,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT appointments_notes_length CHECK (((notes IS NULL) OR (char_length(notes) <= 1000))),
    CONSTRAINT appointments_status_check CHECK (((status)::text = ANY ((ARRAY['Booked'::character varying, 'Called'::character varying, 'Converted'::character varying, 'Cancelled'::character varying, 'Completed'::character varying, 'No Show'::character varying])::text[])))
);


--
-- Name: appointments_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.appointments_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: appointments_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.appointments_id_seq OWNED BY public.appointments.id;


--
-- Name: contact_messages; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.contact_messages (
    id integer NOT NULL,
    name character varying(120) NOT NULL,
    email character varying(255) NOT NULL,
    phone character varying(30),
    message text NOT NULL,
    ip_address inet,
    user_agent text,
    handled_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: contact_messages_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.contact_messages_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: contact_messages_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.contact_messages_id_seq OWNED BY public.contact_messages.id;


--
-- Name: courses; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.courses (
    id integer NOT NULL,
    name character varying(100) NOT NULL,
    slug character varying(100) NOT NULL,
    description text,
    icon_name character varying(50),
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: courses_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.courses_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: courses_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.courses_id_seq OWNED BY public.courses.id;


--
-- Name: exams; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.exams (
    id integer NOT NULL,
    name character varying(100) NOT NULL,
    slug character varying(100) NOT NULL,
    exam_date character varying(100),
    exam_level character varying(100),
    info jsonb,
    application_form jsonb,
    important_dates jsonb,
    syllabus jsonb,
    exam_pattern jsonb,
    admit_card_details text,
    result_details text,
    cutoff_details text,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: exams_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.exams_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: exams_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.exams_id_seq OWNED BY public.exams.id;


--
-- Name: oauth_codes; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.oauth_codes (
    code character varying(128) NOT NULL,
    session_id uuid NOT NULL,
    user_id integer NOT NULL,
    expires_at timestamp with time zone NOT NULL,
    consumed_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: partners; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.partners (
    id integer NOT NULL,
    name character varying(100) NOT NULL,
    location character varying(100),
    featured_text character varying(255),
    logo_url text,
    link_stream_slug character varying(100),
    link_city_slug character varying(100),
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: partners_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.partners_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: partners_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.partners_id_seq OWNED BY public.partners.id;


--
-- Name: schema_migrations; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.schema_migrations (
    version text NOT NULL,
    filename text NOT NULL,
    applied_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: sessions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.sessions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id integer NOT NULL,
    token_hash text NOT NULL,
    family_id uuid NOT NULL,
    parent_id uuid,
    user_agent text,
    ip_address inet,
    expires_at timestamp with time zone NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    last_used_at timestamp with time zone,
    revoked_at timestamp with time zone,
    revoked_reason character varying(60)
);


--
-- Name: stream_courses; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.stream_courses (
    stream_id integer NOT NULL,
    course_id integer NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: streams; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.streams (
    id integer NOT NULL,
    name character varying(100) NOT NULL,
    slug character varying(100) NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: streams_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.streams_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: streams_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.streams_id_seq OWNED BY public.streams.id;


--
-- Name: top_university_streams; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.top_university_streams (
    university_id integer NOT NULL,
    stream_id integer NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: universities; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.universities (
    id integer NOT NULL,
    name character varying(255) NOT NULL,
    slug character varying(255) NOT NULL,
    location character varying(255),
    image_url text,
    rating numeric(2,1) DEFAULT 0.0,
    description text,
    details jsonb,
    courses_and_fees jsonb,
    placements jsonb,
    facilities text[],
    admission_open boolean DEFAULT false,
    admission_year integer,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    is_top_university boolean DEFAULT false,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    city_slug character varying(120) GENERATED ALWAYS AS (public.immutable_slug(split_part((COALESCE(location, ''::character varying))::text, ','::text, 1))) STORED,
    CONSTRAINT universities_admission_year_range CHECK (((admission_year IS NULL) OR ((admission_year >= 2000) AND (admission_year <= 2100)))),
    CONSTRAINT universities_rating_range CHECK (((rating IS NULL) OR ((rating >= (0)::numeric) AND (rating <= (5)::numeric))))
);


--
-- Name: universities_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.universities_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: universities_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.universities_id_seq OWNED BY public.universities.id;


--
-- Name: university_course_offerings; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.university_course_offerings (
    id integer NOT NULL,
    university_id integer NOT NULL,
    course_id integer NOT NULL,
    fee_amount numeric(12,2),
    fee_currency character varying(8) DEFAULT 'INR'::character varying NOT NULL,
    fee_display character varying(120),
    duration character varying(80),
    eligibility text,
    admission_year integer,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT university_course_offerings_fee_amount_check CHECK (((fee_amount IS NULL) OR (fee_amount >= (0)::numeric)))
);


--
-- Name: university_course_offerings_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.university_course_offerings_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: university_course_offerings_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.university_course_offerings_id_seq OWNED BY public.university_course_offerings.id;


--
-- Name: university_streams; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.university_streams (
    university_id integer NOT NULL,
    stream_id integer NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: users; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.users (
    id integer NOT NULL,
    google_id character varying(255),
    full_name character varying(100) NOT NULL,
    email character varying(255) NOT NULL,
    password_hash character varying(255),
    role public.user_role DEFAULT 'user'::public.user_role NOT NULL,
    phone_number character varying(20),
    whatsapp_number character varying(20),
    state_hometown character varying(100),
    choice_of_stream character varying(100),
    choice_of_stream_other character varying(100),
    entry_level character varying(100),
    entry_level_other character varying(100),
    how_heard character varying(100),
    how_heard_other character varying(100),
    referred_by integer,
    referral_status character varying(50) DEFAULT 'Not Referred'::character varying,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT users_phone_length_check CHECK (((phone_number IS NULL) OR (char_length((phone_number)::text) <= 20))),
    CONSTRAINT users_referral_status_check CHECK (((referral_status)::text = ANY ((ARRAY['Not Referred'::character varying, 'Referred'::character varying, 'Converted'::character varying])::text[])))
);


--
-- Name: users_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.users_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: users_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.users_id_seq OWNED BY public.users.id;


--
-- Name: application_status_history id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.application_status_history ALTER COLUMN id SET DEFAULT nextval('public.application_status_history_id_seq'::regclass);


--
-- Name: applications id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.applications ALTER COLUMN id SET DEFAULT nextval('public.applications_id_seq'::regclass);


--
-- Name: appointment_status_history id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.appointment_status_history ALTER COLUMN id SET DEFAULT nextval('public.appointment_status_history_id_seq'::regclass);


--
-- Name: appointments id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.appointments ALTER COLUMN id SET DEFAULT nextval('public.appointments_id_seq'::regclass);


--
-- Name: contact_messages id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.contact_messages ALTER COLUMN id SET DEFAULT nextval('public.contact_messages_id_seq'::regclass);


--
-- Name: courses id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.courses ALTER COLUMN id SET DEFAULT nextval('public.courses_id_seq'::regclass);


--
-- Name: exams id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.exams ALTER COLUMN id SET DEFAULT nextval('public.exams_id_seq'::regclass);


--
-- Name: partners id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.partners ALTER COLUMN id SET DEFAULT nextval('public.partners_id_seq'::regclass);


--
-- Name: streams id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.streams ALTER COLUMN id SET DEFAULT nextval('public.streams_id_seq'::regclass);


--
-- Name: universities id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.universities ALTER COLUMN id SET DEFAULT nextval('public.universities_id_seq'::regclass);


--
-- Name: university_course_offerings id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.university_course_offerings ALTER COLUMN id SET DEFAULT nextval('public.university_course_offerings_id_seq'::regclass);


--
-- Name: users id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users ALTER COLUMN id SET DEFAULT nextval('public.users_id_seq'::regclass);


--
-- Name: application_status_history application_status_history_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.application_status_history
    ADD CONSTRAINT application_status_history_pkey PRIMARY KEY (id);


--
-- Name: applications applications_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.applications
    ADD CONSTRAINT applications_pkey PRIMARY KEY (id);


--
-- Name: applications applications_user_id_university_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.applications
    ADD CONSTRAINT applications_user_id_university_id_key UNIQUE (user_id, university_id);


--
-- Name: appointment_status_history appointment_status_history_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.appointment_status_history
    ADD CONSTRAINT appointment_status_history_pkey PRIMARY KEY (id);


--
-- Name: appointments appointments_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.appointments
    ADD CONSTRAINT appointments_pkey PRIMARY KEY (id);


--
-- Name: contact_messages contact_messages_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.contact_messages
    ADD CONSTRAINT contact_messages_pkey PRIMARY KEY (id);


--
-- Name: courses courses_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.courses
    ADD CONSTRAINT courses_pkey PRIMARY KEY (id);


--
-- Name: courses courses_slug_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.courses
    ADD CONSTRAINT courses_slug_key UNIQUE (slug);


--
-- Name: exams exams_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.exams
    ADD CONSTRAINT exams_pkey PRIMARY KEY (id);


--
-- Name: exams exams_slug_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.exams
    ADD CONSTRAINT exams_slug_key UNIQUE (slug);


--
-- Name: oauth_codes oauth_codes_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.oauth_codes
    ADD CONSTRAINT oauth_codes_pkey PRIMARY KEY (code);


--
-- Name: partners partners_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.partners
    ADD CONSTRAINT partners_pkey PRIMARY KEY (id);


--
-- Name: schema_migrations schema_migrations_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.schema_migrations
    ADD CONSTRAINT schema_migrations_pkey PRIMARY KEY (version);


--
-- Name: sessions sessions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sessions
    ADD CONSTRAINT sessions_pkey PRIMARY KEY (id);


--
-- Name: sessions sessions_token_hash_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sessions
    ADD CONSTRAINT sessions_token_hash_key UNIQUE (token_hash);


--
-- Name: stream_courses stream_courses_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.stream_courses
    ADD CONSTRAINT stream_courses_pkey PRIMARY KEY (stream_id, course_id);


--
-- Name: streams streams_name_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.streams
    ADD CONSTRAINT streams_name_key UNIQUE (name);


--
-- Name: streams streams_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.streams
    ADD CONSTRAINT streams_pkey PRIMARY KEY (id);


--
-- Name: streams streams_slug_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.streams
    ADD CONSTRAINT streams_slug_key UNIQUE (slug);


--
-- Name: top_university_streams top_university_streams_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.top_university_streams
    ADD CONSTRAINT top_university_streams_pkey PRIMARY KEY (university_id, stream_id);


--
-- Name: universities universities_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.universities
    ADD CONSTRAINT universities_pkey PRIMARY KEY (id);


--
-- Name: universities universities_slug_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.universities
    ADD CONSTRAINT universities_slug_key UNIQUE (slug);


--
-- Name: university_course_offerings university_course_offerings_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.university_course_offerings
    ADD CONSTRAINT university_course_offerings_pkey PRIMARY KEY (id);


--
-- Name: university_course_offerings university_course_offerings_university_id_course_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.university_course_offerings
    ADD CONSTRAINT university_course_offerings_university_id_course_id_key UNIQUE (university_id, course_id);


--
-- Name: university_streams university_streams_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.university_streams
    ADD CONSTRAINT university_streams_pkey PRIMARY KEY (university_id, stream_id);


--
-- Name: users users_email_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_key UNIQUE (email);


--
-- Name: users users_google_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_google_id_key UNIQUE (google_id);


--
-- Name: users users_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_pkey PRIMARY KEY (id);


--
-- Name: appointments_unique_active_slot; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX appointments_unique_active_slot ON public.appointments USING btree (user_id, appointment_date) WHERE ((status)::text = 'Booked'::text);


--
-- Name: idx_application_history_application; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_application_history_application ON public.application_status_history USING btree (application_id);


--
-- Name: idx_applications_course_offering; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_applications_course_offering ON public.applications USING btree (course_offering_id);


--
-- Name: idx_applications_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_applications_status ON public.applications USING btree (status);


--
-- Name: idx_applications_university_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_applications_university_id ON public.applications USING btree (university_id);


--
-- Name: idx_appointment_history_appointment; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_appointment_history_appointment ON public.appointment_status_history USING btree (appointment_id);


--
-- Name: idx_appointments_date; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_appointments_date ON public.appointments USING btree (appointment_date);


--
-- Name: idx_appointments_status_date; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_appointments_status_date ON public.appointments USING btree (status, appointment_date);


--
-- Name: idx_appointments_user_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_appointments_user_id ON public.appointments USING btree (user_id);


--
-- Name: idx_contact_messages_created_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_contact_messages_created_at ON public.contact_messages USING btree (created_at DESC);


--
-- Name: idx_courses_created_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_courses_created_at ON public.courses USING btree (created_at);


--
-- Name: idx_exams_created_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_exams_created_at ON public.exams USING btree (created_at);


--
-- Name: idx_oauth_codes_expires; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_oauth_codes_expires ON public.oauth_codes USING btree (expires_at);


--
-- Name: idx_offerings_course_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_offerings_course_id ON public.university_course_offerings USING btree (course_id);


--
-- Name: idx_offerings_university_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_offerings_university_id ON public.university_course_offerings USING btree (university_id);


--
-- Name: idx_sessions_active_expiry; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_sessions_active_expiry ON public.sessions USING btree (expires_at) WHERE (revoked_at IS NULL);


--
-- Name: idx_sessions_family_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_sessions_family_id ON public.sessions USING btree (family_id);


--
-- Name: idx_sessions_user_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_sessions_user_id ON public.sessions USING btree (user_id);


--
-- Name: idx_stream_courses_course_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_stream_courses_course_id ON public.stream_courses USING btree (course_id);


--
-- Name: idx_top_university_streams_stream_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_top_university_streams_stream_id ON public.top_university_streams USING btree (stream_id);


--
-- Name: idx_universities_city_slug; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_universities_city_slug ON public.universities USING btree (city_slug);


--
-- Name: idx_universities_courses_and_fees; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_universities_courses_and_fees ON public.universities USING gin (courses_and_fees);


--
-- Name: idx_universities_top_rating; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_universities_top_rating ON public.universities USING btree (is_top_university, rating DESC);


--
-- Name: idx_university_streams_stream_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_university_streams_stream_id ON public.university_streams USING btree (stream_id);


--
-- Name: idx_users_referred_by; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_users_referred_by ON public.users USING btree (referred_by);


--
-- Name: idx_users_role; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_users_role ON public.users USING btree (role);


--
-- Name: users_email_lower_unique; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX users_email_lower_unique ON public.users USING btree (lower((email)::text));


--
-- Name: applications applications_set_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER applications_set_updated_at BEFORE UPDATE ON public.applications FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


--
-- Name: appointments appointments_set_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER appointments_set_updated_at BEFORE UPDATE ON public.appointments FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


--
-- Name: courses courses_set_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER courses_set_updated_at BEFORE UPDATE ON public.courses FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


--
-- Name: exams exams_set_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER exams_set_updated_at BEFORE UPDATE ON public.exams FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


--
-- Name: partners partners_set_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER partners_set_updated_at BEFORE UPDATE ON public.partners FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


--
-- Name: streams streams_set_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER streams_set_updated_at BEFORE UPDATE ON public.streams FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


--
-- Name: universities universities_set_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER universities_set_updated_at BEFORE UPDATE ON public.universities FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


--
-- Name: university_course_offerings university_course_offerings_set_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER university_course_offerings_set_updated_at BEFORE UPDATE ON public.university_course_offerings FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


--
-- Name: users users_set_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER users_set_updated_at BEFORE UPDATE ON public.users FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


--
-- Name: application_status_history application_status_history_application_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.application_status_history
    ADD CONSTRAINT application_status_history_application_id_fkey FOREIGN KEY (application_id) REFERENCES public.applications(id) ON DELETE CASCADE;


--
-- Name: application_status_history application_status_history_changed_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.application_status_history
    ADD CONSTRAINT application_status_history_changed_by_fkey FOREIGN KEY (changed_by) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: applications applications_course_offering_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.applications
    ADD CONSTRAINT applications_course_offering_id_fkey FOREIGN KEY (course_offering_id) REFERENCES public.university_course_offerings(id) ON DELETE SET NULL;


--
-- Name: applications applications_university_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.applications
    ADD CONSTRAINT applications_university_id_fkey FOREIGN KEY (university_id) REFERENCES public.universities(id) ON DELETE CASCADE;


--
-- Name: applications applications_updated_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.applications
    ADD CONSTRAINT applications_updated_by_fkey FOREIGN KEY (updated_by) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: applications applications_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.applications
    ADD CONSTRAINT applications_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: appointment_status_history appointment_status_history_appointment_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.appointment_status_history
    ADD CONSTRAINT appointment_status_history_appointment_id_fkey FOREIGN KEY (appointment_id) REFERENCES public.appointments(id) ON DELETE CASCADE;


--
-- Name: appointment_status_history appointment_status_history_changed_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.appointment_status_history
    ADD CONSTRAINT appointment_status_history_changed_by_fkey FOREIGN KEY (changed_by) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: appointments appointments_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.appointments
    ADD CONSTRAINT appointments_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: oauth_codes oauth_codes_session_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.oauth_codes
    ADD CONSTRAINT oauth_codes_session_id_fkey FOREIGN KEY (session_id) REFERENCES public.sessions(id) ON DELETE CASCADE;


--
-- Name: oauth_codes oauth_codes_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.oauth_codes
    ADD CONSTRAINT oauth_codes_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: sessions sessions_parent_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sessions
    ADD CONSTRAINT sessions_parent_id_fkey FOREIGN KEY (parent_id) REFERENCES public.sessions(id) ON DELETE SET NULL;


--
-- Name: sessions sessions_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sessions
    ADD CONSTRAINT sessions_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: stream_courses stream_courses_course_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.stream_courses
    ADD CONSTRAINT stream_courses_course_id_fkey FOREIGN KEY (course_id) REFERENCES public.courses(id) ON DELETE CASCADE;


--
-- Name: stream_courses stream_courses_stream_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.stream_courses
    ADD CONSTRAINT stream_courses_stream_id_fkey FOREIGN KEY (stream_id) REFERENCES public.streams(id) ON DELETE CASCADE;


--
-- Name: top_university_streams top_stream_requires_stream; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.top_university_streams
    ADD CONSTRAINT top_stream_requires_stream FOREIGN KEY (university_id, stream_id) REFERENCES public.university_streams(university_id, stream_id) ON DELETE CASCADE;


--
-- Name: top_university_streams top_university_streams_stream_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.top_university_streams
    ADD CONSTRAINT top_university_streams_stream_id_fkey FOREIGN KEY (stream_id) REFERENCES public.streams(id) ON DELETE CASCADE;


--
-- Name: top_university_streams top_university_streams_university_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.top_university_streams
    ADD CONSTRAINT top_university_streams_university_id_fkey FOREIGN KEY (university_id) REFERENCES public.universities(id) ON DELETE CASCADE;


--
-- Name: university_course_offerings university_course_offerings_course_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.university_course_offerings
    ADD CONSTRAINT university_course_offerings_course_id_fkey FOREIGN KEY (course_id) REFERENCES public.courses(id) ON DELETE CASCADE;


--
-- Name: university_course_offerings university_course_offerings_university_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.university_course_offerings
    ADD CONSTRAINT university_course_offerings_university_id_fkey FOREIGN KEY (university_id) REFERENCES public.universities(id) ON DELETE CASCADE;


--
-- Name: university_streams university_streams_stream_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.university_streams
    ADD CONSTRAINT university_streams_stream_id_fkey FOREIGN KEY (stream_id) REFERENCES public.streams(id) ON DELETE CASCADE;


--
-- Name: university_streams university_streams_university_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.university_streams
    ADD CONSTRAINT university_streams_university_id_fkey FOREIGN KEY (university_id) REFERENCES public.universities(id) ON DELETE CASCADE;


--
-- Name: users users_referred_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_referred_by_fkey FOREIGN KEY (referred_by) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- PostgreSQL database dump complete
--

\unrestrict OCMahWsQUf3yufKbpcRX7HpI3s5jmj2x2d9hoMcE1j4lGvEFV3jM47DCFxtEO1q

