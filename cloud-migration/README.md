# Firesky Ops — Google Cloud Migration

## What's in this folder

| File | Purpose |
|---|---|
| `schema.sql` | PostgreSQL schema only (create tables, indexes, enums) |
| `data.sql` | Current data only (INSERT statements) |
| `full-migration.sql` | Schema + data combined — use this for a fresh import |
| `deploy-to-cloud-run.sh` | Automated deployment script |

---

## Prerequisites

- [Google Cloud SDK](https://cloud.google.com/sdk/docs/install) installed and logged in
- A Google Cloud project with billing enabled

---

## Quick start

### 1. Create your secrets in Secret Manager

Before deploying, add each secret:

```bash
gcloud secrets create GEMINI_API_KEY --data-file=- <<< 'your-gemini-api-key'
gcloud secrets create CLERK_SECRET_KEY --data-file=- <<< 'your-clerk-secret-key'
gcloud secrets create VITE_CLERK_PUBLISHABLE_KEY --data-file=- <<< 'your-clerk-publishable-key'
gcloud secrets create RESEND_API_KEY --data-file=- <<< 'your-resend-api-key'
gcloud secrets create SESSION_SECRET --data-file=- <<< "$(openssl rand -base64 32)"
```

### 2. Edit and run the deploy script

```bash
cd cloud-migration
# Edit the variables at the top of deploy-to-cloud-run.sh
nano deploy-to-cloud-run.sh

chmod +x deploy-to-cloud-run.sh
./deploy-to-cloud-run.sh
```

The script will:
1. Enable the required Google Cloud APIs
2. Build and push the Docker image via Cloud Build
3. Create a GCS bucket for file storage
4. Create a Cloud SQL (PostgreSQL 16) instance
5. Import your database (schema + all existing data)
6. Deploy the app to Cloud Run
7. Grant the service account the storage and signing permissions it needs

---

## Manual database import (if you prefer)

If you already have a Cloud SQL instance:

```bash
# Upload the migration file
gsutil cp full-migration.sql gs://YOUR_BUCKET/migration/full-migration.sql

# Import into Cloud SQL
gcloud sql import sql YOUR_INSTANCE gs://YOUR_BUCKET/migration/full-migration.sql \
  --database=YOUR_DB_NAME
```

---

## After deployment

### Update Clerk

Add your Cloud Run URL to Clerk's allowed origins:
1. Go to [clerk.com](https://clerk.com) → your app → Settings → Domains
2. Add your `*.run.app` URL

### Custom domain (optional)

```bash
gcloud run domain-mappings create \
  --service firesky-ops \
  --domain app.yourdomain.com \
  --region YOUR_REGION
```

---

## Environment variables reference

| Variable | Description |
|---|---|
| `DATABASE_URL` | Cloud SQL connection string |
| `GOOGLE_CLOUD_PROJECT` | Your GCP project ID |
| `GEMINI_API_KEY` | Gemini API key (from Secret Manager) |
| `CLERK_SECRET_KEY` | Clerk secret key (from Secret Manager) |
| `VITE_CLERK_PUBLISHABLE_KEY` | Clerk publishable key (from Secret Manager) |
| `SESSION_SECRET` | Random string for session signing |
| `RESEND_API_KEY` | Resend email API key |
| `PUBLIC_OBJECT_SEARCH_PATHS` | GCS path for public files, e.g. `//bucket/public` |
| `PRIVATE_OBJECT_DIR` | GCS path for private files, e.g. `//bucket/private` |
