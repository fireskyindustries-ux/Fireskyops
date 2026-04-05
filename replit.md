# Firesky Industries Field Operations App

## Overview

A mobile-first React web app for Firesky Industries — a field operations tool for capturing customer enquiries, remote farm location details, site inspection and installation-prep information, and managing jobs through a pipeline toward quoting.

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
- `RESEND_API_KEY` — Resend API key for sending customer notification emails (get from resend.com)
- `TRACKING_BASE_URL` — Base URL for customer tracking links in emails (e.g. `https://fireskyindustries.co.za/firesky` or `https://{REPLIT_DEV_DOMAIN}/firesky`)
- `SESSION_SECRET` — Already configured via Replit secrets

## Features
- **Customer Notification System** — Automatic emails via Resend on job stage changes:
  - Email fires automatically when stage changes (enquiry → inspection → quoting → quoted → won)
  - Per-job toggle to enable/disable notifications (on by default if customer has email)
  - Customer tracking page at `/track/{token}` — public, no login required, shows job progress timeline
  - Copy tracking link from job detail page to share manually
  - WhatsApp tap-to-message button on job and customer records
  - Sender: `info@fireskyindustries.co.za` via Resend (domain must be verified in Resend)

- **Calendar**: Week and list views for inspections/deliveries/installations, with travel-buffer conflict detection and double-booking prevention. Schedule button on job detail page. Accessible to admin and field workers.


- **Sky AI Assistant** — built-in AI assistant powered by OpenAI (via Replit AI Integrations, billed to Replit credits):
  - Floating "Ask Sky" button on all pages (mobile and desktop)
  - Inline "Ask Sky" button on each record (inspection, customer, enquiry, job, dashboard)
  - Context-aware: reads the currently open record and uses it in responses
  - Streaming chat interface with conversation history per session
  - Suggested actions per context: "Review this inspection", "Summarize for quote", "Stand or plinth?", "Check missing details", etc.
  - Firesky-specific system prompt: knows about tanks, stand/plinth decisions, site access, pipe runs, delivery risks
- **Dashboard** — summary stats, pipeline stage breakdown, recent enquiries and jobs
- **Customer CRM** — searchable customer/farm list with full remote location support
- **New Enquiry Form** — fast capture in the field, JSON-driven field config
- **Site Inspection Form** — detailed tank placement & installation prep form:
  - Tank size, quantity, stand/plinth requirements
  - Pipe lengths, distances from road/house
  - Truck/trailer access, offloading constraints
  - Ground condition, site photos
  - Readiness-to-quote flag
  - Remote location fields: farm name, nearest town, manual directions, landmarks, WhatsApp location, access notes
- **Jobs Pipeline** — kanban-style board with stages: enquiry → inspection → quoting → quoted → won → lost
- **Draft saving** — forms auto-save to localStorage

## Key Commands

- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- `pnpm --filter @workspace/api-server run dev` — run API server locally
- `pnpm --filter @workspace/firesky run dev` — run frontend locally

## Architecture

- **lib/api-spec/openapi.yaml** — single source of truth for API contract
- **lib/db/src/schema/** — Drizzle DB schema (customers, enquiries, inspections, jobs, conversations, messages)
- **lib/integrations-openai-ai-server/** — OpenAI SDK client wired to Replit AI Integrations
- **artifacts/api-server/src/routes/sky.ts** — `/api/sky/chat` SSE endpoint with Firesky system prompt
- **artifacts/firesky/src/components/sky/** — Sky context provider, panel, floating button, inline button
- **artifacts/api-server/src/routes/** — Express route handlers (customers, enquiries, inspections, jobs, dashboard, sky)
- **artifacts/firesky/src/** — React frontend app
  - All forms are driven by JSON field config arrays for easy future expansion

## Data Models

- **Customer** — contact info + full remote location fields (farmName, nearestTown, manualDirections, landmarks, whatsappLocation, accessNotes)
- **Enquiry** — linked to customer, tank requirements, status pipeline
- **Inspection** — full site assessment (stand/plinth, pipe lengths, distances, access, photos, readiness)
- **Job** — linked to customer/enquiry/inspection, stage pipeline, estimated value

See `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details.
