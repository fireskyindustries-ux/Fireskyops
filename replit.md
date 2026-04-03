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

## Features

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
- **lib/db/src/schema/** — Drizzle DB schema (customers, enquiries, inspections, jobs)
- **artifacts/api-server/src/routes/** — Express route handlers (customers, enquiries, inspections, jobs, dashboard)
- **artifacts/firesky/src/** — React frontend app
  - All forms are driven by JSON field config arrays for easy future expansion

## Data Models

- **Customer** — contact info + full remote location fields (farmName, nearestTown, manualDirections, landmarks, whatsappLocation, accessNotes)
- **Enquiry** — linked to customer, tank requirements, status pipeline
- **Inspection** — full site assessment (stand/plinth, pipe lengths, distances, access, photos, readiness)
- **Job** — linked to customer/enquiry/inspection, stage pipeline, estimated value

See `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details.
