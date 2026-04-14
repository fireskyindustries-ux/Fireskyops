#!/bin/bash
# =============================================================
# Firesky Industries — Google Cloud Run deployment script
# Fill in the variables below, then run:
#   chmod +x deploy-to-cloud-run.sh && ./deploy-to-cloud-run.sh
# =============================================================

set -euo pipefail

# ─── FILL THESE IN ───────────────────────────────────────────
PROJECT_ID="your-gcp-project-id"
REGION="europe-west1"           # or us-central1, asia-east1, etc.
SERVICE_NAME="firesky-ops"
BUCKET_NAME="firesky-ops-files" # GCS bucket you'll create
DB_INSTANCE="firesky-db"        # Cloud SQL instance name
DB_NAME="firesky"
DB_USER="firesky_user"
# ─────────────────────────────────────────────────────────────

IMAGE="gcr.io/${PROJECT_ID}/${SERVICE_NAME}"

echo ""
echo "=== Firesky Cloud Run deployment ==="
echo "Project : $PROJECT_ID"
echo "Region  : $REGION"
echo "Image   : $IMAGE"
echo ""

# 1. Set active project
gcloud config set project "$PROJECT_ID"

# 2. Enable required APIs
echo "[1/7] Enabling Google Cloud APIs..."
gcloud services enable \
  run.googleapis.com \
  cloudbuild.googleapis.com \
  sqladmin.googleapis.com \
  storage.googleapis.com \
  secretmanager.googleapis.com \
  --quiet

# 3. Build and push container using Cloud Build (no local Docker needed)
echo "[2/7] Building and pushing container..."
gcloud builds submit \
  --tag "$IMAGE" \
  --timeout=20m \
  ../

# 4. Create GCS bucket (if it doesn't exist)
echo "[3/7] Creating storage bucket..."
gsutil mb -p "$PROJECT_ID" -l "$REGION" "gs://${BUCKET_NAME}" 2>/dev/null || echo "  Bucket already exists, skipping."

# 5. Create Cloud SQL instance (PostgreSQL 16)
echo "[4/7] Creating Cloud SQL instance (this takes a few minutes)..."
gcloud sql instances create "$DB_INSTANCE" \
  --database-version=POSTGRES_16 \
  --tier=db-g1-small \
  --region="$REGION" \
  --storage-type=SSD \
  --storage-size=10GB \
  --backup-start-time=02:00 \
  2>/dev/null || echo "  Instance already exists, skipping."

gcloud sql databases create "$DB_NAME" --instance="$DB_INSTANCE" 2>/dev/null || true
gcloud sql users create "$DB_USER" --instance="$DB_INSTANCE" --password="$(openssl rand -base64 24)" 2>/dev/null || true

DB_PASSWORD=$(gcloud sql users describe "$DB_USER" --instance="$DB_INSTANCE" --format='value(password)' 2>/dev/null || echo "SET_MANUALLY")
CLOUD_SQL_CONNECTION=$(gcloud sql instances describe "$DB_INSTANCE" --format='value(connectionName)')
DATABASE_URL="postgresql://${DB_USER}:${DB_PASSWORD}@localhost/${DB_NAME}?host=/cloudsql/${CLOUD_SQL_CONNECTION}"

echo ""
echo "  Cloud SQL connection: $CLOUD_SQL_CONNECTION"
echo ""

# 6. Import schema and data into Cloud SQL
echo "[5/7] Importing database..."
echo "  Upload migration file to bucket..."
gsutil cp full-migration.sql "gs://${BUCKET_NAME}/migration/full-migration.sql"
echo "  Run import..."
gcloud sql import sql "$DB_INSTANCE" "gs://${BUCKET_NAME}/migration/full-migration.sql" \
  --database="$DB_NAME" \
  --quiet

# 7. Deploy to Cloud Run
echo "[6/7] Deploying to Cloud Run..."
gcloud run deploy "$SERVICE_NAME" \
  --image "$IMAGE" \
  --region "$REGION" \
  --platform managed \
  --allow-unauthenticated \
  --add-cloudsql-instances "$CLOUD_SQL_CONNECTION" \
  --set-env-vars "NODE_ENV=production,PORT=8080,GOOGLE_CLOUD_PROJECT=${PROJECT_ID}" \
  --set-env-vars "PUBLIC_OBJECT_SEARCH_PATHS=//${BUCKET_NAME}/public" \
  --set-env-vars "PRIVATE_OBJECT_DIR=//${BUCKET_NAME}/private" \
  --set-env-vars "DATABASE_URL=${DATABASE_URL}" \
  --set-secrets "GEMINI_API_KEY=GEMINI_API_KEY:latest,CLERK_SECRET_KEY=CLERK_SECRET_KEY:latest,VITE_CLERK_PUBLISHABLE_KEY=VITE_CLERK_PUBLISHABLE_KEY:latest,SESSION_SECRET=SESSION_SECRET:latest,RESEND_API_KEY=RESEND_API_KEY:latest" \
  --memory 512Mi \
  --cpu 1 \
  --min-instances 0 \
  --max-instances 10

# 8. Grant Cloud Run service account storage + signing permissions
echo "[7/7] Granting service account permissions..."
SA_EMAIL=$(gcloud run services describe "$SERVICE_NAME" --region "$REGION" --format='value(spec.template.spec.serviceAccountName)')
gcloud projects add-iam-policy-binding "$PROJECT_ID" \
  --member="serviceAccount:${SA_EMAIL}" \
  --role="roles/storage.objectAdmin"
gcloud projects add-iam-policy-binding "$PROJECT_ID" \
  --member="serviceAccount:${SA_EMAIL}" \
  --role="roles/iam.serviceAccountTokenCreator"

SERVICE_URL=$(gcloud run services describe "$SERVICE_NAME" --region "$REGION" --format='value(status.url)')

echo ""
echo "=== Deployment complete ==="
echo "URL: $SERVICE_URL"
echo ""
echo "Next steps:"
echo "  1. Add $SERVICE_URL to your Clerk allowed origins"
echo "  2. Store your secrets in Secret Manager:"
echo "     gcloud secrets create GEMINI_API_KEY --data-file=- <<< 'your-key'"
echo "     gcloud secrets create CLERK_SECRET_KEY --data-file=- <<< 'your-key'"
echo "     gcloud secrets create VITE_CLERK_PUBLISHABLE_KEY --data-file=- <<< 'your-key'"
echo "     gcloud secrets create SESSION_SECRET --data-file=- <<< '\$(openssl rand -base64 32)'"
echo "     gcloud secrets create RESEND_API_KEY --data-file=- <<< 'your-key'"
