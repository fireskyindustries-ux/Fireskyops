-- ============================================================
-- Firesky Industries Field Ops — Cloud SQL Migration
-- Run this against a fresh Cloud SQL (PostgreSQL 16) database
-- ============================================================

--
-- PostgreSQL database dump
--

\restrict Ft2h5eSuvDhX8Y1fKSWaE4d7s4gO1ETR9ledExzPjTLisFOLhYgqLquWKzYb9Dh

-- Dumped from database version 16.10
-- Dumped by pg_dump version 16.10

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Name: email_status; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.email_status AS ENUM (
    'sent',
    'failed'
);


--
-- Name: email_type; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.email_type AS ENUM (
    'quote',
    'job_stage',
    'other'
);


--
-- Name: quote_status; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.quote_status AS ENUM (
    'draft',
    'sent',
    'accepted',
    'rejected'
);


SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: appointments; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.appointments (
    id integer NOT NULL,
    job_id integer NOT NULL,
    type text DEFAULT 'inspection'::text NOT NULL,
    title text NOT NULL,
    scheduled_at timestamp with time zone NOT NULL,
    duration_minutes integer DEFAULT 120 NOT NULL,
    travel_buffer_minutes integer DEFAULT 30 NOT NULL,
    assigned_to_id text,
    assigned_to_name text,
    notes text,
    status text DEFAULT 'scheduled'::text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
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
-- Name: conversations; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.conversations (
    id integer NOT NULL,
    title text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: conversations_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.conversations_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: conversations_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.conversations_id_seq OWNED BY public.conversations.id;


--
-- Name: customers; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.customers (
    id integer NOT NULL,
    name text NOT NULL,
    contact_name text,
    phone text,
    email text,
    farm_name text,
    nearest_town text,
    province text,
    manual_directions text,
    landmarks text,
    whatsapp_location text,
    access_notes text,
    notes text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: customers_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.customers_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: customers_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.customers_id_seq OWNED BY public.customers.id;


--
-- Name: email_logs; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.email_logs (
    id integer NOT NULL,
    "to" text NOT NULL,
    subject text NOT NULL,
    type public.email_type NOT NULL,
    status public.email_status NOT NULL,
    customer_id integer,
    related_type text,
    related_id integer,
    resend_id text,
    error text,
    sent_at timestamp without time zone DEFAULT now() NOT NULL
);


--
-- Name: email_logs_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.email_logs_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: email_logs_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.email_logs_id_seq OWNED BY public.email_logs.id;


--
-- Name: enquiries; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.enquiries (
    id integer NOT NULL,
    customer_id integer NOT NULL,
    title text NOT NULL,
    description text,
    tank_size text,
    tank_quantity integer,
    status text DEFAULT 'new'::text NOT NULL,
    priority text DEFAULT 'medium'::text NOT NULL,
    notes text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    next_action text,
    next_action_date date,
    follow_up_due_date date,
    assigned_staff text
);


--
-- Name: enquiries_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.enquiries_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: enquiries_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.enquiries_id_seq OWNED BY public.enquiries.id;


--
-- Name: inspections; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.inspections (
    id integer NOT NULL,
    enquiry_id integer,
    customer_id integer NOT NULL,
    farm_name text,
    nearest_town text,
    manual_directions text,
    landmarks text,
    whatsapp_location text,
    access_notes text,
    tank_size text,
    tank_quantity integer,
    requires_stand boolean DEFAULT false,
    requires_plinth boolean DEFAULT false,
    stand_height text,
    plinth_details text,
    pipe_length real,
    pipe_details text,
    distance_from_road real,
    distance_from_house real,
    truck_access boolean DEFAULT false,
    trailer_access boolean DEFAULT false,
    offloading_constraints text,
    ground_condition text,
    site_ready_to_quote boolean DEFAULT false,
    photo_urls text[],
    notes text,
    inspected_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    assigned_to_id text
);


--
-- Name: inspections_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.inspections_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: inspections_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.inspections_id_seq OWNED BY public.inspections.id;


--
-- Name: job_loads; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.job_loads (
    id integer NOT NULL,
    job_id integer NOT NULL,
    load_number integer NOT NULL,
    status text DEFAULT 'pending'::text NOT NULL,
    scheduled_date timestamp with time zone,
    delivered_at timestamp with time zone,
    tank_size text,
    tank_quantity integer,
    driver_name text,
    vehicle_reg text,
    notes text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: job_loads_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.job_loads_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: job_loads_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.job_loads_id_seq OWNED BY public.job_loads.id;


--
-- Name: jobs; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.jobs (
    id integer NOT NULL,
    customer_id integer NOT NULL,
    enquiry_id integer,
    inspection_id integer,
    title text NOT NULL,
    stage text DEFAULT 'enquiry'::text NOT NULL,
    priority text DEFAULT 'medium'::text NOT NULL,
    tank_size text,
    tank_quantity integer,
    estimated_value real,
    notes text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    assigned_to_id text,
    customer_token text DEFAULT gen_random_uuid(),
    notifications_enabled boolean DEFAULT true NOT NULL,
    job_type text DEFAULT 'full_install'::text NOT NULL,
    next_action text,
    next_action_date date,
    follow_up_due_date date,
    quote_sent_date date,
    lost_reason text,
    access_risk text
);


--
-- Name: jobs_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.jobs_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: jobs_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.jobs_id_seq OWNED BY public.jobs.id;


--
-- Name: messages; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.messages (
    id integer NOT NULL,
    conversation_id integer NOT NULL,
    role text NOT NULL,
    content text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: messages_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.messages_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: messages_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.messages_id_seq OWNED BY public.messages.id;


--
-- Name: notifications; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.notifications (
    id integer NOT NULL,
    user_id text NOT NULL,
    title text NOT NULL,
    body text,
    link text,
    read boolean DEFAULT false NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: notifications_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.notifications_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: notifications_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.notifications_id_seq OWNED BY public.notifications.id;


--
-- Name: push_subscriptions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.push_subscriptions (
    id integer NOT NULL,
    user_id text NOT NULL,
    endpoint text NOT NULL,
    p256dh text NOT NULL,
    auth text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: push_subscriptions_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.push_subscriptions_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: push_subscriptions_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.push_subscriptions_id_seq OWNED BY public.push_subscriptions.id;


--
-- Name: quotes; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.quotes (
    id integer NOT NULL,
    enquiry_id integer,
    customer_id integer NOT NULL,
    job_id integer,
    file_url text NOT NULL,
    status public.quote_status DEFAULT 'sent'::public.quote_status NOT NULL,
    notes text,
    sent_at timestamp without time zone DEFAULT now(),
    responded_at timestamp without time zone,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL,
    quote_token uuid DEFAULT gen_random_uuid() NOT NULL,
    payment_proof_url text
);


--
-- Name: quotes_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.quotes_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: quotes_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.quotes_id_seq OWNED BY public.quotes.id;


--
-- Name: appointments id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.appointments ALTER COLUMN id SET DEFAULT nextval('public.appointments_id_seq'::regclass);


--
-- Name: conversations id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.conversations ALTER COLUMN id SET DEFAULT nextval('public.conversations_id_seq'::regclass);


--
-- Name: customers id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.customers ALTER COLUMN id SET DEFAULT nextval('public.customers_id_seq'::regclass);


--
-- Name: email_logs id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.email_logs ALTER COLUMN id SET DEFAULT nextval('public.email_logs_id_seq'::regclass);


--
-- Name: enquiries id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.enquiries ALTER COLUMN id SET DEFAULT nextval('public.enquiries_id_seq'::regclass);


--
-- Name: inspections id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.inspections ALTER COLUMN id SET DEFAULT nextval('public.inspections_id_seq'::regclass);


--
-- Name: job_loads id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.job_loads ALTER COLUMN id SET DEFAULT nextval('public.job_loads_id_seq'::regclass);


--
-- Name: jobs id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.jobs ALTER COLUMN id SET DEFAULT nextval('public.jobs_id_seq'::regclass);


--
-- Name: messages id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.messages ALTER COLUMN id SET DEFAULT nextval('public.messages_id_seq'::regclass);


--
-- Name: notifications id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.notifications ALTER COLUMN id SET DEFAULT nextval('public.notifications_id_seq'::regclass);


--
-- Name: push_subscriptions id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.push_subscriptions ALTER COLUMN id SET DEFAULT nextval('public.push_subscriptions_id_seq'::regclass);


--
-- Name: quotes id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.quotes ALTER COLUMN id SET DEFAULT nextval('public.quotes_id_seq'::regclass);


--
-- Name: appointments appointments_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.appointments
    ADD CONSTRAINT appointments_pkey PRIMARY KEY (id);


--
-- Name: conversations conversations_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.conversations
    ADD CONSTRAINT conversations_pkey PRIMARY KEY (id);


--
-- Name: customers customers_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.customers
    ADD CONSTRAINT customers_pkey PRIMARY KEY (id);


--
-- Name: email_logs email_logs_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.email_logs
    ADD CONSTRAINT email_logs_pkey PRIMARY KEY (id);


--
-- Name: enquiries enquiries_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.enquiries
    ADD CONSTRAINT enquiries_pkey PRIMARY KEY (id);


--
-- Name: inspections inspections_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.inspections
    ADD CONSTRAINT inspections_pkey PRIMARY KEY (id);


--
-- Name: job_loads job_loads_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.job_loads
    ADD CONSTRAINT job_loads_pkey PRIMARY KEY (id);


--
-- Name: jobs jobs_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.jobs
    ADD CONSTRAINT jobs_pkey PRIMARY KEY (id);


--
-- Name: messages messages_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.messages
    ADD CONSTRAINT messages_pkey PRIMARY KEY (id);


--
-- Name: notifications notifications_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.notifications
    ADD CONSTRAINT notifications_pkey PRIMARY KEY (id);


--
-- Name: push_subscriptions push_subscriptions_endpoint_unique; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.push_subscriptions
    ADD CONSTRAINT push_subscriptions_endpoint_unique UNIQUE (endpoint);


--
-- Name: push_subscriptions push_subscriptions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.push_subscriptions
    ADD CONSTRAINT push_subscriptions_pkey PRIMARY KEY (id);


--
-- Name: quotes quotes_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.quotes
    ADD CONSTRAINT quotes_pkey PRIMARY KEY (id);


--
-- Name: quotes quotes_quote_token_unique; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.quotes
    ADD CONSTRAINT quotes_quote_token_unique UNIQUE (quote_token);


--
-- Name: appointments appointments_job_id_jobs_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.appointments
    ADD CONSTRAINT appointments_job_id_jobs_id_fk FOREIGN KEY (job_id) REFERENCES public.jobs(id);


--
-- Name: email_logs email_logs_customer_id_customers_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.email_logs
    ADD CONSTRAINT email_logs_customer_id_customers_id_fk FOREIGN KEY (customer_id) REFERENCES public.customers(id);


--
-- Name: enquiries enquiries_customer_id_customers_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.enquiries
    ADD CONSTRAINT enquiries_customer_id_customers_id_fk FOREIGN KEY (customer_id) REFERENCES public.customers(id);


--
-- Name: inspections inspections_customer_id_customers_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.inspections
    ADD CONSTRAINT inspections_customer_id_customers_id_fk FOREIGN KEY (customer_id) REFERENCES public.customers(id);


--
-- Name: inspections inspections_enquiry_id_enquiries_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.inspections
    ADD CONSTRAINT inspections_enquiry_id_enquiries_id_fk FOREIGN KEY (enquiry_id) REFERENCES public.enquiries(id);


--
-- Name: job_loads job_loads_job_id_jobs_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.job_loads
    ADD CONSTRAINT job_loads_job_id_jobs_id_fk FOREIGN KEY (job_id) REFERENCES public.jobs(id) ON DELETE CASCADE;


--
-- Name: jobs jobs_customer_id_customers_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.jobs
    ADD CONSTRAINT jobs_customer_id_customers_id_fk FOREIGN KEY (customer_id) REFERENCES public.customers(id);


--
-- Name: jobs jobs_enquiry_id_enquiries_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.jobs
    ADD CONSTRAINT jobs_enquiry_id_enquiries_id_fk FOREIGN KEY (enquiry_id) REFERENCES public.enquiries(id);


--
-- Name: jobs jobs_inspection_id_inspections_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.jobs
    ADD CONSTRAINT jobs_inspection_id_inspections_id_fk FOREIGN KEY (inspection_id) REFERENCES public.inspections(id);


--
-- Name: messages messages_conversation_id_conversations_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.messages
    ADD CONSTRAINT messages_conversation_id_conversations_id_fk FOREIGN KEY (conversation_id) REFERENCES public.conversations(id) ON DELETE CASCADE;


--
-- Name: quotes quotes_customer_id_customers_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.quotes
    ADD CONSTRAINT quotes_customer_id_customers_id_fk FOREIGN KEY (customer_id) REFERENCES public.customers(id);


--
-- Name: quotes quotes_enquiry_id_enquiries_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.quotes
    ADD CONSTRAINT quotes_enquiry_id_enquiries_id_fk FOREIGN KEY (enquiry_id) REFERENCES public.enquiries(id);


--
-- Name: quotes quotes_job_id_jobs_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.quotes
    ADD CONSTRAINT quotes_job_id_jobs_id_fk FOREIGN KEY (job_id) REFERENCES public.jobs(id);


--
-- PostgreSQL database dump complete
--

\unrestrict Ft2h5eSuvDhX8Y1fKSWaE4d7s4gO1ETR9ledExzPjTLisFOLhYgqLquWKzYb9Dh


--
-- PostgreSQL database dump
--

\restrict WmcSb70dfkjuVCGUhbpZvWfxasB3Gydf55KgmBoJdcToKL6PMD9NwgcEdVKZriZ

-- Dumped from database version 16.10
-- Dumped by pg_dump version 16.10

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Data for Name: customers; Type: TABLE DATA; Schema: public; Owner: -
--

INSERT INTO public.customers (id, name, contact_name, phone, email, farm_name, nearest_town, province, manual_directions, landmarks, whatsapp_location, access_notes, notes, created_at, updated_at) VALUES (2, 'Steyn Family Farm', 'Kobus Steyn', '082 555 1234', 'kobus@steynfarm.co.za', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, '2026-04-09 12:08:23.309935+00', '2026-04-09 12:08:23.309935+00');
INSERT INTO public.customers (id, name, contact_name, phone, email, farm_name, nearest_town, province, manual_directions, landmarks, whatsapp_location, access_notes, notes, created_at, updated_at) VALUES (3, 'Leon Mouton', NULL, '0836300263', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 'Location: Roodewal small holdings Bloemfontein', '2026-04-11 07:52:59.703602+00', '2026-04-11 07:52:59.703602+00');
INSERT INTO public.customers (id, name, contact_name, phone, email, farm_name, nearest_town, province, manual_directions, landmarks, whatsapp_location, access_notes, notes, created_at, updated_at) VALUES (4, 'Jane Smith', NULL, '0821234567', 'jane@example.com', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, '2026-04-11 17:26:32.792252+00', '2026-04-11 17:26:32.792252+00');
INSERT INTO public.customers (id, name, contact_name, phone, email, farm_name, nearest_town, province, manual_directions, landmarks, whatsapp_location, access_notes, notes, created_at, updated_at) VALUES (5, 'Jane Smith', NULL, '0821110001', 'jane@example.com', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, '2026-04-11 17:26:44.336136+00', '2026-04-11 17:26:44.336136+00');


--
-- Data for Name: enquiries; Type: TABLE DATA; Schema: public; Owner: -
--

INSERT INTO public.enquiries (id, customer_id, title, description, tank_size, tank_quantity, status, priority, notes, created_at, updated_at, next_action, next_action_date, follow_up_due_date, assigned_staff) VALUES (2, 2, '3x 10000L LLDPE tanks — Steyn Farm', NULL, NULL, NULL, 'in_progress', 'high', NULL, '2026-04-09 12:08:27.261978+00', '2026-04-09 12:08:27.261978+00', 'Call Kobus to confirm site dimensions', '2026-04-14', '2026-04-16', 'Riaan Botha');
INSERT INTO public.enquiries (id, customer_id, title, description, tank_size, tank_quantity, status, priority, notes, created_at, updated_at, next_action, next_action_date, follow_up_due_date, assigned_staff) VALUES (3, 2, '[TEST] Overdue follow-up enquiry', NULL, NULL, NULL, 'in_progress', 'medium', NULL, '2026-04-09 12:17:37.677425+00', '2026-04-09 12:17:37.677425+00', 'Check site access', NULL, '2026-04-01', NULL);
INSERT INTO public.enquiries (id, customer_id, title, description, tank_size, tank_quantity, status, priority, notes, created_at, updated_at, next_action, next_action_date, follow_up_due_date, assigned_staff) VALUES (4, 2, '[TEST] No next action enquiry (null)', NULL, NULL, NULL, 'in_progress', 'medium', NULL, '2026-04-09 12:17:41.655843+00', '2026-04-09 12:17:41.655843+00', NULL, NULL, NULL, NULL);
INSERT INTO public.enquiries (id, customer_id, title, description, tank_size, tank_quantity, status, priority, notes, created_at, updated_at, next_action, next_action_date, follow_up_due_date, assigned_staff) VALUES (5, 2, '[TEST] No next action enquiry (empty)', NULL, NULL, NULL, 'in_progress', 'medium', NULL, '2026-04-09 12:17:45.457887+00', '2026-04-09 12:17:45.457887+00', '', NULL, NULL, NULL);
INSERT INTO public.enquiries (id, customer_id, title, description, tank_size, tank_quantity, status, priority, notes, created_at, updated_at, next_action, next_action_date, follow_up_due_date, assigned_staff) VALUES (6, 3, 'Backup water tank for a 4-person home, covering the whole house during 2-day water cuts', 'Need: Backup water tank for a 4-person home, covering the whole house during 2-day water cuts

Recommended: 2500L water tank with pump recommended

Notes: Customer may need a pump and would like a site inspection scheduled', NULL, NULL, 'new', 'medium', 'Source: Fire Vision | Location: Roodewal small holdings Bloemfontein', '2026-04-11 07:52:59.740712+00', '2026-04-11 07:52:59.740712+00', NULL, NULL, NULL, NULL);
INSERT INTO public.enquiries (id, customer_id, title, description, tank_size, tank_quantity, status, priority, notes, created_at, updated_at, next_action, next_action_date, follow_up_due_date, assigned_staff) VALUES (7, 4, 'Need a fire suppression system', 'Need: Need a fire suppression system', NULL, NULL, 'new', 'high', 'Source: Fire Vision', '2026-04-11 17:26:32.829253+00', '2026-04-11 17:26:32.829253+00', NULL, NULL, NULL, NULL);
INSERT INTO public.enquiries (id, customer_id, title, description, tank_size, tank_quantity, status, priority, notes, created_at, updated_at, next_action, next_action_date, follow_up_due_date, assigned_staff) VALUES (8, 5, 'Need fire suppression', 'Need: Need fire suppression', NULL, NULL, 'new', 'high', 'Source: Fire Vision', '2026-04-11 17:26:44.340751+00', '2026-04-11 17:26:44.340751+00', NULL, NULL, NULL, NULL);
INSERT INTO public.enquiries (id, customer_id, title, description, tank_size, tank_quantity, status, priority, notes, created_at, updated_at, next_action, next_action_date, follow_up_due_date, assigned_staff) VALUES (9, 5, 'Follow-up issue', 'Need: Follow-up issue', NULL, NULL, 'new', 'medium', 'Source: Fire Vision', '2026-04-11 17:26:44.447331+00', '2026-04-11 17:26:44.447331+00', NULL, NULL, NULL, NULL);


--
-- Data for Name: inspections; Type: TABLE DATA; Schema: public; Owner: -
--



--
-- Data for Name: jobs; Type: TABLE DATA; Schema: public; Owner: -
--

INSERT INTO public.jobs (id, customer_id, enquiry_id, inspection_id, title, stage, priority, tank_size, tank_quantity, estimated_value, notes, created_at, updated_at, assigned_to_id, customer_token, notifications_enabled, job_type, next_action, next_action_date, follow_up_due_date, quote_sent_date, lost_reason, access_risk) VALUES (3, 2, 2, NULL, '3x 10000L Full Install — Steyn Farm', 'quoted', 'high', NULL, NULL, NULL, NULL, '2026-04-09 12:08:31.054939+00', '2026-04-09 12:08:31.054939+00', NULL, '67874049-0156-4df9-bb65-6ac5ac9a3181', true, 'full_install', 'Follow up on quote acceptance', '2026-04-15', '2026-04-17', '2026-04-10', NULL, 'medium');
INSERT INTO public.jobs (id, customer_id, enquiry_id, inspection_id, title, stage, priority, tank_size, tank_quantity, estimated_value, notes, created_at, updated_at, assigned_to_id, customer_token, notifications_enabled, job_type, next_action, next_action_date, follow_up_due_date, quote_sent_date, lost_reason, access_risk) VALUES (4, 2, NULL, NULL, '[TEST] Overdue follow-up job', 'quoting', 'medium', NULL, NULL, NULL, NULL, '2026-04-09 12:18:03.105015+00', '2026-04-09 12:18:03.105015+00', NULL, 'ff386fb3-73a1-4d1e-8888-d6468feae190', true, 'full_install', 'Chase customer', NULL, '2026-04-01', NULL, NULL, NULL);
INSERT INTO public.jobs (id, customer_id, enquiry_id, inspection_id, title, stage, priority, tank_size, tank_quantity, estimated_value, notes, created_at, updated_at, assigned_to_id, customer_token, notifications_enabled, job_type, next_action, next_action_date, follow_up_due_date, quote_sent_date, lost_reason, access_risk) VALUES (5, 2, NULL, NULL, '[TEST] No next action job (null)', 'inspection', 'low', NULL, NULL, NULL, NULL, '2026-04-09 12:18:07.374744+00', '2026-04-09 12:18:07.374744+00', NULL, '71154037-95b1-4c76-ad00-eaafe32eae4b', true, 'full_install', NULL, NULL, NULL, NULL, NULL, NULL);
INSERT INTO public.jobs (id, customer_id, enquiry_id, inspection_id, title, stage, priority, tank_size, tank_quantity, estimated_value, notes, created_at, updated_at, assigned_to_id, customer_token, notifications_enabled, job_type, next_action, next_action_date, follow_up_due_date, quote_sent_date, lost_reason, access_risk) VALUES (6, 2, NULL, NULL, '[TEST] No next action job (empty)', 'enquiry', 'low', NULL, NULL, NULL, NULL, '2026-04-09 12:18:11.158377+00', '2026-04-09 12:18:11.158377+00', NULL, '5650990a-4bd9-47dd-a8b7-18bf8de78425', true, 'full_install', '', NULL, NULL, NULL, NULL, NULL);
INSERT INTO public.jobs (id, customer_id, enquiry_id, inspection_id, title, stage, priority, tank_size, tank_quantity, estimated_value, notes, created_at, updated_at, assigned_to_id, customer_token, notifications_enabled, job_type, next_action, next_action_date, follow_up_due_date, quote_sent_date, lost_reason, access_risk) VALUES (7, 2, NULL, NULL, '[TEST] Quoted, no follow-up date', 'quoted', 'medium', NULL, NULL, NULL, NULL, '2026-04-09 12:18:14.945917+00', '2026-04-09 12:18:14.945917+00', NULL, 'e09efad4-bfa8-4d66-851a-b840a8b00e14', true, 'full_install', 'Await customer response', NULL, NULL, NULL, NULL, NULL);
INSERT INTO public.jobs (id, customer_id, enquiry_id, inspection_id, title, stage, priority, tank_size, tank_quantity, estimated_value, notes, created_at, updated_at, assigned_to_id, customer_token, notifications_enabled, job_type, next_action, next_action_date, follow_up_due_date, quote_sent_date, lost_reason, access_risk) VALUES (8, 2, NULL, NULL, '[TEST] Lost, no reason', 'lost', 'medium', NULL, NULL, NULL, NULL, '2026-04-09 12:18:18.930681+00', '2026-04-09 12:18:18.930681+00', NULL, '2ac9e973-99a8-4838-887e-3fc3e6c58ada', true, 'full_install', NULL, NULL, NULL, NULL, NULL, NULL);
INSERT INTO public.jobs (id, customer_id, enquiry_id, inspection_id, title, stage, priority, tank_size, tank_quantity, estimated_value, notes, created_at, updated_at, assigned_to_id, customer_token, notifications_enabled, job_type, next_action, next_action_date, follow_up_due_date, quote_sent_date, lost_reason, access_risk) VALUES (9, 2, NULL, NULL, '[TEST] High access risk job', 'quoting', 'high', NULL, NULL, NULL, NULL, '2026-04-09 12:18:22.88301+00', '2026-04-09 12:18:22.88301+00', NULL, '25a70b54-4114-4d95-a110-e32440a94f7d', true, 'full_install', 'Arrange site visit', NULL, NULL, NULL, NULL, 'high');


--
-- Data for Name: appointments; Type: TABLE DATA; Schema: public; Owner: -
--



--
-- Data for Name: conversations; Type: TABLE DATA; Schema: public; Owner: -
--



--
-- Data for Name: email_logs; Type: TABLE DATA; Schema: public; Owner: -
--



--
-- Data for Name: job_loads; Type: TABLE DATA; Schema: public; Owner: -
--



--
-- Data for Name: messages; Type: TABLE DATA; Schema: public; Owner: -
--



--
-- Data for Name: notifications; Type: TABLE DATA; Schema: public; Owner: -
--



--
-- Data for Name: push_subscriptions; Type: TABLE DATA; Schema: public; Owner: -
--



--
-- Data for Name: quotes; Type: TABLE DATA; Schema: public; Owner: -
--



--
-- Name: appointments_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.appointments_id_seq', 1, false);


--
-- Name: conversations_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.conversations_id_seq', 1, false);


--
-- Name: customers_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.customers_id_seq', 5, true);


--
-- Name: email_logs_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.email_logs_id_seq', 1, false);


--
-- Name: enquiries_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.enquiries_id_seq', 9, true);


--
-- Name: inspections_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.inspections_id_seq', 1, false);


--
-- Name: job_loads_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.job_loads_id_seq', 1, false);


--
-- Name: jobs_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.jobs_id_seq', 9, true);


--
-- Name: messages_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.messages_id_seq', 1, false);


--
-- Name: notifications_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.notifications_id_seq', 1, false);


--
-- Name: push_subscriptions_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.push_subscriptions_id_seq', 1, false);


--
-- Name: quotes_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.quotes_id_seq', 1, false);


--
-- PostgreSQL database dump complete
--

\unrestrict WmcSb70dfkjuVCGUhbpZvWfxasB3Gydf55KgmBoJdcToKL6PMD9NwgcEdVKZriZ

