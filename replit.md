# Firesky Industries Field Operations App

## Overview

A mobile-first React web app for Firesky Industries — a field operations tool for capturing customer enquiries, remote farm location details, site inspection and installation-prep information, and managing jobs through a pipeline toward quoting.

## White-Label / Brand Config System

The codebase is white-label ready. When cloning for a new client, edit **two files only**:

- `artifacts/firesky/src/brand.config.ts` — all frontend brand config
- `artifacts/api-server/src/brand.config.ts` — all backend brand config

Both files are thoroughly commented and cover:
- Business name, short name, tagline, app title
- Primary colour (used in Clerk auth UI, buttons, charts, PDFs, emails)
- Logo and splash image filenames (assets go in `/public`)
- Contact email and website
- Industry / product language (e.g. "tank" → "panel", "borehole")
- Sky AI persona name and description
- Email FROM address and all email subject lines / body text
- WhatsApp message templates
- PDF report header and footer
- Default branch name (seed data)
- Footer credit line

Also update manually per clone:
- `artifacts/firesky/index.html` — `<title>` and `apple-mobile-web-app-title`
- `/public/` — replace logo.png and splash.png with client assets

## Stack

- **Monorepo tool**: pnpm workspaces
- **Node.js version**: 24
- **Package manager**: pnpm
- **TypeScript version**: 5.9
- **Frontend**: React + Vite (artifacts/firesky) — mobile-first, responsive
- **API framework**: Express 5 (artifacts/api-server)
- **Database**: PostgreSQL + Drizzle ORM
- **Validation**: Zod (`zod/v4`), `drizzle-zod`
- **API codegen**: Orval (from OpenAPI spec)
- **Build**: esbuild (CJS bundle)

## Environment Variables Required
- `RESEND_API_KEY` — Resend API key for sending customer notification emails
- `TRACKING_BASE_URL` — Base URL for customer tracking links in emails
- `SESSION_SECRET` — Already configured via Replit secrets
- `OPENAI_API_KEY` — OpenAI API key for Sky AI (GPT-5)

## Photo Capture, Digital Sign-Off & PDF Reports
- **Photo Capture** — `PhotoPicker` component (4-slot grid, client-side JPEG compression to ~200KB/photo, `capture="environment"` for mobile camera, stored as base64 in `photoUrls text[]`)
- **Digital Sign-Off** — `SignaturePad` component (HTML canvas, mouse + touch, 600×200px, save as PNG base64)
  - Stored as `signatureUrl text`, `signedOffBy text`, `signedOffAt timestamptz` on both inspections and jobs tables
  - Shows signed badge (blue "Signed Off") on detail page headers once signed
- **PDF Reports** — `generateInspectionPDF()` and `generateJobPDF()` in `artifacts/firesky/src/lib/pdf-generator.ts`
  - Uses jsPDF, A4 format, Firesky orange branding
  - Embeds compressed photos and signature PNG in the PDF
  - Downloaded client-side (no server round-trip)
  - Buttons: "PDF Report" on inspection detail and job detail pages

## Multi-Branch Architecture
- **Branches** — `branches` table: id, name, region, address, phone, email
- **Stock Catalogue** — `stock_items` table: global item catalogue (admin-managed)
- **Stock Levels** — `stock_levels` table: quantity per branch per item, updated by movements
- **Stock Movements** — `stock_movements` table: in/out/adjustment records per branch
- **Branch scoping** — customers, enquiries, jobs, inspections all have nullable `branchId`
  - Admins see all records across branches; branch_admin/user see only their branch
- **Roles**: `admin` (full access), `branch_admin` (branch-scoped admin), `user` (field worker), `guest`
  - Field workers have legacy role `"user"` in Clerk metadata
  - Branch assigned via `public_metadata.branchId` in Clerk
- **Default branch**: id=1 ("Main Branch / Head Office") — all pre-existing data assigned here
- **Frontend pages**: `/stock` (inventory + movements + catalogue tab for admin), `/admin/branches`
- **Users admin**: branch assignment dropdown per user alongside role selector

## Dashboards
- **Admin dashboard** (`/`) — cross-branch overview: stat cards, pipeline breakdown, stale/urgent alerts, branch breakdown cards, recent enquiries/jobs
- **Branch admin dashboard** (`/`) — branch-scoped: stat cards for their branch only, stale/urgent alerts, recent enquiries/jobs, stock snapshot

## Features

- **Quote Upload & Acceptance Flow** — Full quote lifecycle:
  - Admin uploads quote PDF from enquiry detail page (after inspection done)
  - PDF stored via object storage (`objectPath` stored in `quotes` table)
  - Customer emailed with link to `/quote/{quoteToken}` page (no login required)
  - Customer can Accept or Decline quote with optional reason
  - On accept: enquiry advances to `won`, job (if linked) advances to `won`
  - Team notified of customer response via in-app notification

- **Customer Notification System** — Automatic emails via Resend on job stage changes:
  - Email fires automatically when stage changes (enquiry → inspection → quoting → quoted → won)
  - Per-job toggle to enable/disable notifications (on by default if customer has email)
  - Customer tracking page at `/track/{token}` — public, no login required, shows job progress timeline
  - Copy tracking link from job detail page to share manually
  - WhatsApp tap-to-message button on job and customer records
  - Sender: `info@fireskyindustries.co.za` via Resend (domain must be verified in Resend)

- **Calendar**: Week and list views for inspections/deliveries/installations, with travel-buffer conflict detection and double-booking prevention.

- **Sky AI Assistant** — powered by OpenAI GPT-5:
  - Floating "Ask Sky" button on all pages (mobile and desktop)
  - Inline "Ask Sky" button on each record (inspection, customer, enquiry, job, dashboard)
  - Context-aware: reads the currently open record and uses it in responses
  - Streaming chat interface with conversation history per session
  - **4 distinct Sky modes** based on verified server-side role:
    - **Admin**: full tool-calling agent loop — reads/writes all records, manages all branches and stock
    - **Branch admin**: stock tool loop scoped to their branch (branch_id auto-injected, cannot touch other branches)
    - **Field worker**: plain conversational Sky with inspection/job guidance
    - **Guest/customer**: product guidance only — helps choose tanks, pumps, stands; never sees internal data
  - Role is always verified server-side — client-supplied role is ignored

- **Stock Management**:
  - Per-branch stock levels with movement history (in / out / adjustment)
  - Global stock item catalogue (admin-managed)
  - Sky can manage stock via natural language for admin and branch admins

- **Dashboard** — summary stats, pipeline stage breakdown, recent enquiries and jobs
- **Customer CRM** — searchable customer/farm list with full remote location support
- **New Enquiry Form** — fast capture in the field, GPS/WhatsApp location support
- **Site Inspection Form** — detailed tank placement & installation prep form:
  - Tank size, quantity, stand/plinth requirements
  - Pipe lengths, distances from road/house
  - Truck/trailer access, offloading constraints
  - Ground condition, site photos
  - Readiness-to-quote flag
  - Remote location fields: farm name, nearest town, manual directions, landmarks, WhatsApp location, access notes
- **Jobs Pipeline** — kanban-style board with stages: enquiry → inspection → quoting → quoted → won → lost
- **Delivery Loads** — track loads per job
- **Draft saving** — forms auto-save to localStorage

## Sky Vision — Standalone AI Chat App

A separate standalone web app for all Firesky staff at `/sky-vision/` (port 8081 in dev).

- **Auth**: Clerk (same account as Field Ops — no separate login needed for staff)
- **Access**: All logged-in Firesky staff, same Clerk app
- **Memory**: Three-layer memory system:
  1. **Conversation history** — full DB-persisted message history per conversation (`conversations` + `messages` tables)
  2. **Notepad** — curated facts auto-extracted from each exchange via GPT (`user_memories` table). User-editable.
  3. **Vector memory** — every exchange embedded with `text-embedding-3-small` (1536 dims) and stored in `sky_memory_chunks` table with pgvector. Retrieved via cosine similarity on each new message and injected into the system prompt as "RELEVANT PAST CONTEXT".
- **AI**: GPT-5, streaming SSE via `/api/sky-vision/conversations/:id/chat`
- **Features**: Conversation sidebar, rename/delete, auto-titles after first AI reply, streaming typing indicator, memory panel with Notepad + Conversation Memory tabs
- **Theme**: Dark mode only, Firesky orange `#e85d04` accent
- **API routes**: `artifacts/api-server/src/routes/sky-vision.ts` — full CRUD + SSE streaming
- **Frontend**: `artifacts/sky-vision/` — React + Vite + Clerk, hooks in `src/hooks/`, chat UI in `src/pages/chat.tsx`
- **Port fix**: Uses port 8081 (registered in `.replit [[ports]]`); mockup-sandbox was already unused

## Key Commands

- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- `pnpm --filter @workspace/api-server run dev` — run API server locally
- `pnpm --filter @workspace/firesky run dev` — run frontend locally

## Architecture

- **lib/api-spec/openapi.yaml** — single source of truth for API contract
- **lib/db/src/schema/** — Drizzle DB schema (customers, enquiries, inspections, jobs, branches, stock_items, stock_levels, stock_movements)
- **sky_memory_chunks** — pgvector table (created at startup via seed.ts raw SQL, NOT via drizzle-kit push). Columns: id, user_id, content, embedding vector(1536), source, source_id, created_at
- **sky_diary_events** — personal diary/calendar table (created via seed.ts raw SQL, NOT drizzle-kit). Columns: id, user_id, title, description, start_at, end_at, all_day, type (event/meeting/task/reminder), status (scheduled/completed/cancelled), location, color (orange/blue/green/red/purple), created_at, updated_at
- **artifacts/api-server/src/routes/sky.ts** — `/api/sky/chat` SSE endpoint with GPT-5 tool-calling, true token streaming on all paths. Admin tool `query_tanks` queries all IoT tanks (filters: all/offline/low/critical/online).
- **artifacts/api-server/src/routes/portal-sky.ts** — `/api/portal/sky/chat` for Tank Monitor portal. requirePortalAuth, injects live tank data per portal user, streaming SSE. Customer-facing language.
- **artifacts/api-server/src/routes/sky-vision.ts** — Sky Vision routes: conversations, memory chunks, diary CRUD (`/api/sky-vision/diary`), chat SSE with Responses API + diary function tools + web search
- **artifacts/sky-vision/src/pages/calendar.tsx** — Month calendar view for Sky Vision diary; route: `/calendar`
- **artifacts/firesky/src/components/sky/** — Sky context provider, panel, floating button, inline button
- **artifacts/api-server/src/routes/** — Express route handlers
- **artifacts/firesky/src/** — React frontend app

## Tank Monitor Portal (artifacts/monitor/)

Customer-facing IoT water tank monitoring app at `/monitor/`. Same Clerk instance as field ops — no separate login.

- **Auth**: Clerk (Google + email/password). `requirePortalAuth` middleware uses `getAuth()` + upserts `portal_users` row by `clerkUserId`.
- **Pages**: dashboard (all tanks, animated SVG level indicators), tank-detail (recharts area chart, 7-day history), register-tank, subscription
- **Colour coding**: red <20%, amber <50%, green ≥50%
- **Device ingest**: `POST /api/tanks/ingest` authenticated by `FIREVISION_API_KEY` header — accepts `{ serialNumber, levelPercent, litres, batteryPercent }` payloads from IoT firmware
- **Portal Sky**: floating "Ask Sky" button on all portal pages (`PortalSky` component in `artifacts/monitor/src/components/portal-sky.tsx`). Calls `POST /api/portal/sky/chat` — injects live tank readings for that customer into GPT-5 system prompt. Streaming SSE. 4 suggested quick-prompts.
- **Staff-side**: `/tanks` page in Firesky field ops (admin + branch_admin only) — sortable by level/last seen/name, level progress bars, register device dialog
- **Admin Sky tool**: `query_tanks` in `ADMIN_TOOLS` — lets Sky answer "which farms below 20%?", "list offline sensors" etc. across all portal customers

## Data Models

- **Customer** — contact info + full remote location fields (farmName, nearestTown, manualDirections, landmarks, whatsappLocation, accessNotes)
- **Enquiry** — linked to customer, tank requirements, status pipeline
- **Inspection** — full site assessment (stand/plinth, pipe lengths, distances, access, photos, readiness)
- **Job** — linked to customer/enquiry/inspection, stage pipeline, estimated value
- **Branch** — name, region, address, phone, email
- **StockItem** — global catalogue item (name, unit, category, description)
- **StockLevel** — quantity per branch per item
- **StockMovement** — in/out/adjustment record per branch
- **PortalUser** — clerk_user_id, name, email, phone (tank monitor portal account, auto-created on first sign-in)
- **PortalSubscription** — plan, status, dates per portal user
- **Tank** — serialNumber, name, capacityLitres, alertThresholdPercent, locationDescription, lastSeenAt, portalUserId
- **TankReading** — tankId, levelPercent, litres, batteryPercent, recordedAt (time-series IoT readings)
- **TankSupportRequest** — subject, message, status per tank/portal user

## Important Notes
- Do NOT re-add PWA — it breaks publishing
- Dark theme: orange primary `hsl(24 90% 50%)`, no emojis, rounded-full buttons
- `apiFetch` is defined inline in each frontend page (no shared lib/api.ts)
- Sky AI model: `gpt-5` (OpenAI), withRetry handles 429/503. All four chat paths (guest, admin, branch_admin, field_worker) use true token streaming. Admin/branch_admin use streaming tool-call loop (accumulate tool_call deltas, execute, loop). SQL query tool uses `smartQuery()` in `lib/gemini-query.ts`
- Sky Vision diary tools: text chat path uses Responses API with BOTH `web_search_preview` AND `function` tools (create/list/update/delete diary events). Tool-call loop max 3 rounds. Function call events: `response.output_item.added` (type=function_call), `response.function_call_arguments.delta/done`. Tool result injected via `function_call_output` input item.
- Branch admin role = `"branch_admin"` in Clerk public metadata
- Field worker legacy role = `"user"` in Clerk public metadata

See `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details.

## Product Direction Notes
- Plan to rebrand and sell as a white-label field ops SaaS
- Model: upfront project fee (setup + branding) + monthly management/hosting fee
- Target: any field service business with technicians doing site visits and quoting (fire, water/tanks, HVAC, irrigation, electrical, pool)
- Key differentiators: Sky AI assistant, multi-branch stock control, customer notification + tracking, quote acceptance flow
- Skip invoicing — clients use Xero/Sage/QuickBooks already
- Offline capability is the biggest current gap for the rural/farm market
