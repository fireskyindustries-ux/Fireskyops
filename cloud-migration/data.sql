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

