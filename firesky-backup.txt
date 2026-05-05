--
-- PostgreSQL database dump
--

\restrict weTpLKhJ3uwTtAOgvEjX8S3RX5JGfHdzSdi6S3y5NXKUp2Lf9Q9bzLVqnV7cM4b

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
-- Name: vector; Type: EXTENSION; Schema: -; Owner: -
--

CREATE EXTENSION IF NOT EXISTS vector WITH SCHEMA public;


--
-- Name: EXTENSION vector; Type: COMMENT; Schema: -; Owner: -
--

COMMENT ON EXTENSION vector IS 'vector data type and ivfflat and hnsw access methods';


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
-- Name: branches; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.branches (
    id integer NOT NULL,
    name text NOT NULL,
    region text,
    address text,
    phone text,
    email text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    lat double precision,
    lng double precision
);


--
-- Name: branches_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.branches_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: branches_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.branches_id_seq OWNED BY public.branches.id;


--
-- Name: conversations; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.conversations (
    id integer NOT NULL,
    title text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    user_id text,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
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
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    branch_id integer,
    vat_number text,
    billing_address text,
    billing_city text,
    billing_province text,
    billing_postal_code text,
    lat double precision,
    lng double precision
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
    assigned_staff text,
    branch_id integer
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
-- Name: file_uploads; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.file_uploads (
    id integer NOT NULL,
    file_data text NOT NULL,
    content_type text DEFAULT 'application/octet-stream'::text NOT NULL,
    file_name text,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: file_uploads_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.file_uploads_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: file_uploads_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.file_uploads_id_seq OWNED BY public.file_uploads.id;


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
    assigned_to_id text,
    branch_id integer,
    signature_url text,
    signed_off_by text,
    signed_off_at timestamp with time zone,
    visit_type text DEFAULT 'inspection'::text
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
    access_risk text,
    branch_id integer,
    signature_url text,
    signed_off_by text,
    signed_off_at timestamp with time zone
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
-- Name: saved_prompts; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.saved_prompts (
    id integer NOT NULL,
    user_id text NOT NULL,
    title text NOT NULL,
    content text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: saved_prompts_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.saved_prompts_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: saved_prompts_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.saved_prompts_id_seq OWNED BY public.saved_prompts.id;


--
-- Name: sky_diary_events; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.sky_diary_events (
    id integer NOT NULL,
    user_id text NOT NULL,
    title text NOT NULL,
    description text,
    start_at timestamp with time zone NOT NULL,
    end_at timestamp with time zone,
    all_day boolean DEFAULT false NOT NULL,
    type text DEFAULT 'event'::text NOT NULL,
    status text DEFAULT 'scheduled'::text NOT NULL,
    location text,
    color text DEFAULT 'orange'::text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    notified_at timestamp with time zone
);


--
-- Name: sky_diary_events_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.sky_diary_events_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: sky_diary_events_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.sky_diary_events_id_seq OWNED BY public.sky_diary_events.id;


--
-- Name: sky_memory_chunks; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.sky_memory_chunks (
    id integer NOT NULL,
    user_id text NOT NULL,
    content text NOT NULL,
    embedding public.vector(1536) NOT NULL,
    source text DEFAULT 'conversation'::text NOT NULL,
    source_id text,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: sky_memory_chunks_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.sky_memory_chunks_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: sky_memory_chunks_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.sky_memory_chunks_id_seq OWNED BY public.sky_memory_chunks.id;


--
-- Name: stock_items; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.stock_items (
    id integer NOT NULL,
    name text NOT NULL,
    description text,
    unit text DEFAULT 'units'::text NOT NULL,
    category text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: stock_items_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.stock_items_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: stock_items_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.stock_items_id_seq OWNED BY public.stock_items.id;


--
-- Name: stock_levels; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.stock_levels (
    id integer NOT NULL,
    branch_id integer NOT NULL,
    stock_item_id integer NOT NULL,
    quantity integer DEFAULT 0 NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: stock_levels_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.stock_levels_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: stock_levels_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.stock_levels_id_seq OWNED BY public.stock_levels.id;


--
-- Name: stock_movements; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.stock_movements (
    id integer NOT NULL,
    branch_id integer NOT NULL,
    stock_item_id integer NOT NULL,
    type text NOT NULL,
    quantity integer NOT NULL,
    note text,
    user_id text,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: stock_movements_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.stock_movements_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: stock_movements_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.stock_movements_id_seq OWNED BY public.stock_movements.id;


--
-- Name: user_memories; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.user_memories (
    id integer NOT NULL,
    user_id text NOT NULL,
    content text DEFAULT ''::text NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: user_memories_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.user_memories_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: user_memories_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.user_memories_id_seq OWNED BY public.user_memories.id;


--
-- Name: appointments id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.appointments ALTER COLUMN id SET DEFAULT nextval('public.appointments_id_seq'::regclass);


--
-- Name: branches id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.branches ALTER COLUMN id SET DEFAULT nextval('public.branches_id_seq'::regclass);


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
-- Name: file_uploads id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.file_uploads ALTER COLUMN id SET DEFAULT nextval('public.file_uploads_id_seq'::regclass);


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
-- Name: saved_prompts id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.saved_prompts ALTER COLUMN id SET DEFAULT nextval('public.saved_prompts_id_seq'::regclass);


--
-- Name: sky_diary_events id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sky_diary_events ALTER COLUMN id SET DEFAULT nextval('public.sky_diary_events_id_seq'::regclass);


--
-- Name: sky_memory_chunks id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sky_memory_chunks ALTER COLUMN id SET DEFAULT nextval('public.sky_memory_chunks_id_seq'::regclass);


--
-- Name: stock_items id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.stock_items ALTER COLUMN id SET DEFAULT nextval('public.stock_items_id_seq'::regclass);


--
-- Name: stock_levels id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.stock_levels ALTER COLUMN id SET DEFAULT nextval('public.stock_levels_id_seq'::regclass);


--
-- Name: stock_movements id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.stock_movements ALTER COLUMN id SET DEFAULT nextval('public.stock_movements_id_seq'::regclass);


--
-- Name: user_memories id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_memories ALTER COLUMN id SET DEFAULT nextval('public.user_memories_id_seq'::regclass);


--
-- Data for Name: appointments; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.appointments (id, job_id, type, title, scheduled_at, duration_minutes, travel_buffer_minutes, assigned_to_id, assigned_to_name, notes, status, created_at, updated_at) FROM stdin;
\.


--
-- Data for Name: branches; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.branches (id, name, region, address, phone, email, created_at, updated_at, lat, lng) FROM stdin;
1	The Factory	Head Office	\N	\N	\N	2026-04-17 09:39:53.03292+00	2026-04-17 09:39:53.03292+00	\N	\N
\.


--
-- Data for Name: conversations; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.conversations (id, title, created_at, user_id, updated_at) FROM stdin;
\.


--
-- Data for Name: customers; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.customers (id, name, contact_name, phone, email, farm_name, nearest_town, province, manual_directions, landmarks, whatsapp_location, access_notes, notes, created_at, updated_at, branch_id, vat_number, billing_address, billing_city, billing_province, billing_postal_code, lat, lng) FROM stdin;
2	Steyn Family Farm	Kobus Steyn	082 555 1234	kobus@steynfarm.co.za	\N	\N	\N	\N	\N	\N	\N	\N	2026-04-09 12:08:23.309935+00	2026-04-09 12:08:23.309935+00	1	\N	\N	\N	\N	\N	\N	\N
3	Leon Mouton	\N	0836300263	\N	\N	\N	\N	\N	\N	\N	\N	Location: Roodewal small holdings Bloemfontein	2026-04-11 07:52:59.703602+00	2026-04-11 07:52:59.703602+00	1	\N	\N	\N	\N	\N	\N	\N
4	Jane Smith	\N	0821234567	jane@example.com	\N	\N	\N	\N	\N	\N	\N	\N	2026-04-11 17:26:32.792252+00	2026-04-11 17:26:32.792252+00	1	\N	\N	\N	\N	\N	\N	\N
5	Jane Smith	\N	0821110001	jane@example.com	\N	\N	\N	\N	\N	\N	\N	\N	2026-04-11 17:26:44.336136+00	2026-04-11 17:26:44.336136+00	1	\N	\N	\N	\N	\N	\N	\N
\.


--
-- Data for Name: email_logs; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.email_logs (id, "to", subject, type, status, customer_id, related_type, related_id, resend_id, error, sent_at) FROM stdin;
\.


--
-- Data for Name: enquiries; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.enquiries (id, customer_id, title, description, tank_size, tank_quantity, status, priority, notes, created_at, updated_at, next_action, next_action_date, follow_up_due_date, assigned_staff, branch_id) FROM stdin;
2	2	3x 10000L LLDPE tanks — Steyn Farm	\N	\N	\N	in_progress	high	\N	2026-04-09 12:08:27.261978+00	2026-04-09 12:08:27.261978+00	Call Kobus to confirm site dimensions	2026-04-14	2026-04-16	Riaan Botha	1
3	2	[TEST] Overdue follow-up enquiry	\N	\N	\N	in_progress	medium	\N	2026-04-09 12:17:37.677425+00	2026-04-09 12:17:37.677425+00	Check site access	\N	2026-04-01	\N	1
4	2	[TEST] No next action enquiry (null)	\N	\N	\N	in_progress	medium	\N	2026-04-09 12:17:41.655843+00	2026-04-09 12:17:41.655843+00	\N	\N	\N	\N	1
5	2	[TEST] No next action enquiry (empty)	\N	\N	\N	in_progress	medium	\N	2026-04-09 12:17:45.457887+00	2026-04-09 12:17:45.457887+00		\N	\N	\N	1
6	3	Backup water tank for a 4-person home, covering the whole house during 2-day water cuts	Need: Backup water tank for a 4-person home, covering the whole house during 2-day water cuts\n\nRecommended: 2500L water tank with pump recommended\n\nNotes: Customer may need a pump and would like a site inspection scheduled	\N	\N	new	medium	Source: Fire Vision | Location: Roodewal small holdings Bloemfontein	2026-04-11 07:52:59.740712+00	2026-04-11 07:52:59.740712+00	\N	\N	\N	\N	1
7	4	Need a fire suppression system	Need: Need a fire suppression system	\N	\N	new	high	Source: Fire Vision	2026-04-11 17:26:32.829253+00	2026-04-11 17:26:32.829253+00	\N	\N	\N	\N	1
8	5	Need fire suppression	Need: Need fire suppression	\N	\N	new	high	Source: Fire Vision	2026-04-11 17:26:44.340751+00	2026-04-11 17:26:44.340751+00	\N	\N	\N	\N	1
9	5	Follow-up issue	Need: Follow-up issue	\N	\N	new	medium	Source: Fire Vision	2026-04-11 17:26:44.447331+00	2026-04-11 17:26:44.447331+00	\N	\N	\N	\N	1
\.


--
-- Data for Name: file_uploads; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.file_uploads (id, file_data, content_type, file_name, created_at) FROM stdin;
\.


--
-- Data for Name: inspections; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.inspections (id, enquiry_id, customer_id, farm_name, nearest_town, manual_directions, landmarks, whatsapp_location, access_notes, tank_size, tank_quantity, requires_stand, requires_plinth, stand_height, plinth_details, pipe_length, pipe_details, distance_from_road, distance_from_house, truck_access, trailer_access, offloading_constraints, ground_condition, site_ready_to_quote, photo_urls, notes, inspected_at, created_at, updated_at, assigned_to_id, branch_id, signature_url, signed_off_by, signed_off_at, visit_type) FROM stdin;
\.


--
-- Data for Name: job_loads; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.job_loads (id, job_id, load_number, status, scheduled_date, delivered_at, tank_size, tank_quantity, driver_name, vehicle_reg, notes, created_at, updated_at) FROM stdin;
\.


--
-- Data for Name: jobs; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.jobs (id, customer_id, enquiry_id, inspection_id, title, stage, priority, tank_size, tank_quantity, estimated_value, notes, created_at, updated_at, assigned_to_id, customer_token, notifications_enabled, job_type, next_action, next_action_date, follow_up_due_date, quote_sent_date, lost_reason, access_risk, branch_id, signature_url, signed_off_by, signed_off_at) FROM stdin;
3	2	2	\N	3x 10000L Full Install — Steyn Farm	quoted	high	\N	\N	\N	\N	2026-04-09 12:08:31.054939+00	2026-04-09 12:08:31.054939+00	\N	67874049-0156-4df9-bb65-6ac5ac9a3181	t	full_install	Follow up on quote acceptance	2026-04-15	2026-04-17	2026-04-10	\N	medium	1	\N	\N	\N
4	2	\N	\N	[TEST] Overdue follow-up job	quoting	medium	\N	\N	\N	\N	2026-04-09 12:18:03.105015+00	2026-04-09 12:18:03.105015+00	\N	ff386fb3-73a1-4d1e-8888-d6468feae190	t	full_install	Chase customer	\N	2026-04-01	\N	\N	\N	1	\N	\N	\N
5	2	\N	\N	[TEST] No next action job (null)	inspection	low	\N	\N	\N	\N	2026-04-09 12:18:07.374744+00	2026-04-09 12:18:07.374744+00	\N	71154037-95b1-4c76-ad00-eaafe32eae4b	t	full_install	\N	\N	\N	\N	\N	\N	1	\N	\N	\N
6	2	\N	\N	[TEST] No next action job (empty)	enquiry	low	\N	\N	\N	\N	2026-04-09 12:18:11.158377+00	2026-04-09 12:18:11.158377+00	\N	5650990a-4bd9-47dd-a8b7-18bf8de78425	t	full_install		\N	\N	\N	\N	\N	1	\N	\N	\N
7	2	\N	\N	[TEST] Quoted, no follow-up date	quoted	medium	\N	\N	\N	\N	2026-04-09 12:18:14.945917+00	2026-04-09 12:18:14.945917+00	\N	e09efad4-bfa8-4d66-851a-b840a8b00e14	t	full_install	Await customer response	\N	\N	\N	\N	\N	1	\N	\N	\N
8	2	\N	\N	[TEST] Lost, no reason	lost	medium	\N	\N	\N	\N	2026-04-09 12:18:18.930681+00	2026-04-09 12:18:18.930681+00	\N	2ac9e973-99a8-4838-887e-3fc3e6c58ada	t	full_install	\N	\N	\N	\N	\N	\N	1	\N	\N	\N
9	2	\N	\N	[TEST] High access risk job	quoting	high	\N	\N	\N	\N	2026-04-09 12:18:22.88301+00	2026-04-09 12:18:22.88301+00	\N	25a70b54-4114-4d95-a110-e32440a94f7d	t	full_install	Arrange site visit	\N	\N	\N	\N	high	1	\N	\N	\N
\.


--
-- Data for Name: messages; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.messages (id, conversation_id, role, content, created_at) FROM stdin;
\.


--
-- Data for Name: notifications; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.notifications (id, user_id, title, body, link, read, created_at) FROM stdin;
\.


--
-- Data for Name: push_subscriptions; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.push_subscriptions (id, user_id, endpoint, p256dh, auth, created_at) FROM stdin;
\.


--
-- Data for Name: quotes; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.quotes (id, enquiry_id, customer_id, job_id, file_url, status, notes, sent_at, responded_at, created_at, updated_at, quote_token, payment_proof_url) FROM stdin;
\.


--
-- Data for Name: saved_prompts; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.saved_prompts (id, user_id, title, content, created_at) FROM stdin;
\.


--
-- Data for Name: sky_diary_events; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.sky_diary_events (id, user_id, title, description, start_at, end_at, all_day, type, status, location, color, created_at, updated_at, notified_at) FROM stdin;
\.


--
-- Data for Name: sky_memory_chunks; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.sky_memory_chunks (id, user_id, content, embedding, source, source_id, created_at) FROM stdin;
\.


--
-- Data for Name: stock_items; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.stock_items (id, name, description, unit, category, created_at, updated_at) FROM stdin;
1	10000L Tank	10000 litre rotomoulded water/chemical storage tank	units	Tanks	2026-04-17 11:13:26.146+00	2026-04-17 11:13:26.146+00
2	5000L Tank	5000 litre rotomoulded water/chemical storage tank	units	Tanks	2026-04-17 11:13:26.146+00	2026-04-17 11:13:26.146+00
3	2500L Tank	2500 litre rotomoulded water/chemical storage tank	units	Tanks	2026-04-17 11:13:26.146+00	2026-04-17 11:13:26.146+00
4	2000L Tank	2000 litre rotomoulded water/chemical storage tank	units	Tanks	2026-04-17 11:13:26.146+00	2026-04-17 11:13:26.146+00
5	1000L Space Saver	1000 litre space saver / slimline tank	units	Tanks	2026-04-17 11:13:26.146+00	2026-04-17 11:13:26.146+00
6	750L Tank	750 litre rotomoulded water storage tank	units	Tanks	2026-04-17 11:13:26.146+00	2026-04-17 11:13:26.146+00
7	500L Tank	500 litre rotomoulded water storage tank	units	Tanks	2026-04-17 11:13:26.146+00	2026-04-17 11:13:26.146+00
8	250L Tank	250 litre rotomoulded water storage tank	units	Tanks	2026-04-17 11:13:26.146+00	2026-04-17 11:13:26.146+00
9	Tank Stand - 500mm	500mm height galvanised tank stand	units	Stands	2026-04-17 11:13:26.146+00	2026-04-17 11:13:26.146+00
10	Tank Stand - 750mm	750mm height galvanised tank stand	units	Stands	2026-04-17 11:13:26.146+00	2026-04-17 11:13:26.146+00
11	Tank Stand - 1000mm	1000mm height galvanised tank stand	units	Stands	2026-04-17 11:13:26.146+00	2026-04-17 11:13:26.146+00
12	Inlet Ball Valve 25mm	25mm ball valve for tank inlet	units	Fittings	2026-04-17 11:13:26.146+00	2026-04-17 11:13:26.146+00
13	Outlet Ball Valve 25mm	25mm ball valve for tank outlet	units	Fittings	2026-04-17 11:13:26.146+00	2026-04-17 11:13:26.146+00
14	25mm HDPE Pipe	25mm HDPE pressure pipe	metres	Pipes	2026-04-17 11:13:26.146+00	2026-04-17 11:13:26.146+00
15	Pump - Surface Centrifugal	Surface-mounted centrifugal pump	units	Pumps	2026-04-17 11:13:26.146+00	2026-04-17 11:13:26.146+00
16	Pump - Submersible	Submersible pump for borehole/tank	units	Pumps	2026-04-17 11:13:26.146+00	2026-04-17 11:13:26.146+00
17	10,000lt Tank	\N	units	Tanks	2026-04-17 13:22:27.960121+00	2026-04-17 13:22:27.960121+00
18	5,000lt Tank	\N	units	Tanks	2026-04-17 13:22:27.960121+00	2026-04-17 13:22:27.960121+00
19	2,500lt Tank	\N	units	Tanks	2026-04-17 13:22:27.960121+00	2026-04-17 13:22:27.960121+00
20	1,000lt Slimline Tank	\N	units	Tanks	2026-04-17 13:22:27.960121+00	2026-04-17 13:22:27.960121+00
21	0.75kW Pressure Pump	\N	units	Pumps	2026-04-17 13:22:27.960121+00	2026-04-17 13:22:27.960121+00
22	1.1kW Pressure Pump	\N	units	Pumps	2026-04-17 13:22:27.960121+00	2026-04-17 13:22:27.960121+00
23	1.5kW Pressure Pump	\N	units	Pumps	2026-04-17 13:22:27.960121+00	2026-04-17 13:22:27.960121+00
24	0.75kW VSD Pump	\N	units	Pumps	2026-04-17 13:22:27.960121+00	2026-04-17 13:22:27.960121+00
25	1.5kW VSD Pump	\N	units	Pumps	2026-04-17 13:22:27.960121+00	2026-04-17 13:22:27.960121+00
26	25mm Suction Hose Kit	\N	units	Accessories	2026-04-17 13:22:27.960121+00	2026-04-17 13:22:27.960121+00
27	32mm Suction Hose Kit	\N	units	Accessories	2026-04-17 13:22:27.960121+00	2026-04-17 13:22:27.960121+00
28	Float Valve Kit	\N	units	Accessories	2026-04-17 13:22:27.960121+00	2026-04-17 13:22:27.960121+00
29	22mm Installation Kit 50	\N	units	Accessories	2026-04-17 13:22:27.960121+00	2026-04-17 13:22:27.960121+00
30	22mm Installation Kit 100	\N	units	Accessories	2026-04-17 13:22:27.960121+00	2026-04-17 13:22:27.960121+00
\.


--
-- Data for Name: stock_levels; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.stock_levels (id, branch_id, stock_item_id, quantity, updated_at) FROM stdin;
1	1	1	4	2026-04-17 11:13:43.468+00
2	1	2	5	2026-04-17 11:13:43.468+00
3	1	3	6	2026-04-17 11:13:43.468+00
4	1	5	2	2026-04-17 11:13:43.468+00
5	1	4	0	2026-04-17 13:09:28.614318+00
6	1	6	0	2026-04-17 13:09:28.614318+00
7	1	7	0	2026-04-17 13:09:28.614318+00
8	1	8	0	2026-04-17 13:09:28.614318+00
9	1	9	0	2026-04-17 13:09:28.614318+00
10	1	10	0	2026-04-17 13:09:28.614318+00
11	1	11	0	2026-04-17 13:09:28.614318+00
12	1	12	0	2026-04-17 13:09:28.614318+00
13	1	13	0	2026-04-17 13:09:28.614318+00
14	1	14	0	2026-04-17 13:09:28.614318+00
15	1	15	0	2026-04-17 13:09:28.614318+00
16	1	16	0	2026-04-17 13:09:28.614318+00
17	1	17	4	2026-04-17 13:22:27.995226+00
18	1	18	5	2026-04-17 13:22:27.995226+00
19	1	19	6	2026-04-17 13:22:27.995226+00
20	1	20	2	2026-04-17 13:22:27.995226+00
21	1	21	0	2026-04-17 13:22:27.995226+00
22	1	22	0	2026-04-17 13:22:27.995226+00
23	1	23	0	2026-04-17 13:22:27.995226+00
24	1	24	0	2026-04-17 13:22:27.995226+00
25	1	25	0	2026-04-17 13:22:27.995226+00
26	1	26	0	2026-04-17 13:22:27.995226+00
27	1	27	0	2026-04-17 13:22:27.995226+00
28	1	28	0	2026-04-17 13:22:27.995226+00
29	1	29	0	2026-04-17 13:22:27.995226+00
30	1	30	0	2026-04-17 13:22:27.995226+00
\.


--
-- Data for Name: stock_movements; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.stock_movements (id, branch_id, stock_item_id, type, quantity, note, user_id, created_at) FROM stdin;
1	1	1	in	4	Opening stock count	\N	2026-04-17 11:13:43.468+00
2	1	2	in	5	Opening stock count	\N	2026-04-17 11:13:43.468+00
3	1	3	in	6	Opening stock count	\N	2026-04-17 11:13:43.468+00
4	1	5	in	2	Opening stock count	\N	2026-04-17 11:13:43.468+00
\.


--
-- Data for Name: user_memories; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.user_memories (id, user_id, content, updated_at) FROM stdin;
\.


--
-- Name: appointments_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.appointments_id_seq', 1, false);


--
-- Name: branches_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.branches_id_seq', 1, true);


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
-- Name: file_uploads_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.file_uploads_id_seq', 1, false);


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
-- Name: saved_prompts_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.saved_prompts_id_seq', 1, false);


--
-- Name: sky_diary_events_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.sky_diary_events_id_seq', 1, false);


--
-- Name: sky_memory_chunks_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.sky_memory_chunks_id_seq', 1, false);


--
-- Name: stock_items_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.stock_items_id_seq', 30, true);


--
-- Name: stock_levels_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.stock_levels_id_seq', 30, true);


--
-- Name: stock_movements_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.stock_movements_id_seq', 4, true);


--
-- Name: user_memories_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.user_memories_id_seq', 1, false);


--
-- Name: appointments appointments_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.appointments
    ADD CONSTRAINT appointments_pkey PRIMARY KEY (id);


--
-- Name: branches branches_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.branches
    ADD CONSTRAINT branches_pkey PRIMARY KEY (id);


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
-- Name: file_uploads file_uploads_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.file_uploads
    ADD CONSTRAINT file_uploads_pkey PRIMARY KEY (id);


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
-- Name: saved_prompts saved_prompts_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.saved_prompts
    ADD CONSTRAINT saved_prompts_pkey PRIMARY KEY (id);


--
-- Name: sky_diary_events sky_diary_events_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sky_diary_events
    ADD CONSTRAINT sky_diary_events_pkey PRIMARY KEY (id);


--
-- Name: sky_memory_chunks sky_memory_chunks_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sky_memory_chunks
    ADD CONSTRAINT sky_memory_chunks_pkey PRIMARY KEY (id);


--
-- Name: stock_items stock_items_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.stock_items
    ADD CONSTRAINT stock_items_pkey PRIMARY KEY (id);


--
-- Name: stock_levels stock_levels_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.stock_levels
    ADD CONSTRAINT stock_levels_pkey PRIMARY KEY (id);


--
-- Name: stock_movements stock_movements_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.stock_movements
    ADD CONSTRAINT stock_movements_pkey PRIMARY KEY (id);


--
-- Name: user_memories user_memories_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_memories
    ADD CONSTRAINT user_memories_pkey PRIMARY KEY (id);


--
-- Name: user_memories user_memories_user_id_unique; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_memories
    ADD CONSTRAINT user_memories_user_id_unique UNIQUE (user_id);


--
-- Name: sky_diary_events_user_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX sky_diary_events_user_idx ON public.sky_diary_events USING btree (user_id, start_at);


--
-- Name: sky_memory_chunks_user_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX sky_memory_chunks_user_idx ON public.sky_memory_chunks USING btree (user_id);


--
-- Name: appointments appointments_job_id_jobs_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.appointments
    ADD CONSTRAINT appointments_job_id_jobs_id_fk FOREIGN KEY (job_id) REFERENCES public.jobs(id);


--
-- Name: customers customers_branch_id_branches_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.customers
    ADD CONSTRAINT customers_branch_id_branches_id_fk FOREIGN KEY (branch_id) REFERENCES public.branches(id);


--
-- Name: email_logs email_logs_customer_id_customers_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.email_logs
    ADD CONSTRAINT email_logs_customer_id_customers_id_fk FOREIGN KEY (customer_id) REFERENCES public.customers(id);


--
-- Name: enquiries enquiries_branch_id_branches_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.enquiries
    ADD CONSTRAINT enquiries_branch_id_branches_id_fk FOREIGN KEY (branch_id) REFERENCES public.branches(id);


--
-- Name: enquiries enquiries_customer_id_customers_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.enquiries
    ADD CONSTRAINT enquiries_customer_id_customers_id_fk FOREIGN KEY (customer_id) REFERENCES public.customers(id);


--
-- Name: inspections inspections_branch_id_branches_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.inspections
    ADD CONSTRAINT inspections_branch_id_branches_id_fk FOREIGN KEY (branch_id) REFERENCES public.branches(id);


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
-- Name: jobs jobs_branch_id_branches_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.jobs
    ADD CONSTRAINT jobs_branch_id_branches_id_fk FOREIGN KEY (branch_id) REFERENCES public.branches(id);


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
-- Name: stock_levels stock_levels_branch_id_branches_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.stock_levels
    ADD CONSTRAINT stock_levels_branch_id_branches_id_fk FOREIGN KEY (branch_id) REFERENCES public.branches(id);


--
-- Name: stock_levels stock_levels_stock_item_id_stock_items_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.stock_levels
    ADD CONSTRAINT stock_levels_stock_item_id_stock_items_id_fk FOREIGN KEY (stock_item_id) REFERENCES public.stock_items(id);


--
-- Name: stock_movements stock_movements_branch_id_branches_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.stock_movements
    ADD CONSTRAINT stock_movements_branch_id_branches_id_fk FOREIGN KEY (branch_id) REFERENCES public.branches(id);


--
-- Name: stock_movements stock_movements_stock_item_id_stock_items_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.stock_movements
    ADD CONSTRAINT stock_movements_stock_item_id_stock_items_id_fk FOREIGN KEY (stock_item_id) REFERENCES public.stock_items(id);


--
-- PostgreSQL database dump complete
--

\unrestrict weTpLKhJ3uwTtAOgvEjX8S3RX5JGfHdzSdi6S3y5NXKUp2Lf9Q9bzLVqnV7cM4b

