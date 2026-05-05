#!/bin/bash
set -e

echo ""
echo "═══════════════════════════════════════════════════════"
echo "  Firesky Industries — Production Build"
echo "═══════════════════════════════════════════════════════"
echo ""

# ── 1. Build the API server (esbuild bundle) ──────────────────────────────────
echo "▶ Building API server..."
pnpm --filter @workspace/api-server run build
echo "  ✓ API server built → artifacts/api-server/dist/"

# ── 2. Build Firesky frontend ─────────────────────────────────────────────────
echo ""
echo "▶ Building Firesky frontend..."
echo "  NOTE: Set your Clerk publishable key below before running this script."
export BASE_PATH="/"
export PORT="3000"
# Paste your PRODUCTION Clerk publishable key here (starts with pk_live_):
export VITE_CLERK_PUBLISHABLE_KEY="${VITE_CLERK_PUBLISHABLE_KEY:-pk_live_REPLACE_ME}"
export VITE_CLERK_PROXY_URL="https://fireskyops.tech/api/__clerk"
pnpm --filter @workspace/firesky run build
echo "  ✓ Firesky built → artifacts/firesky/dist/public/"

# ── 3. Build Sky Vision frontend ──────────────────────────────────────────────
echo ""
echo "▶ Building Sky Vision frontend..."
export BASE_PATH="/sky-vision/"
export PORT="3001"
pnpm --filter @workspace/sky-vision run build
echo "  ✓ Sky Vision built → artifacts/sky-vision/dist/public/"

# ── 4. Assemble the production package ───────────────────────────────────────
echo ""
echo "▶ Assembling production package → firesky-production/"
rm -rf firesky-production
mkdir -p firesky-production/dist
mkdir -p firesky-production/public/sky-vision

# API server bundle
cp -r artifacts/api-server/dist/. firesky-production/dist/

# Static frontends
cp -r artifacts/firesky/dist/public/. firesky-production/public/
cp -r artifacts/sky-vision/dist/public/. firesky-production/public/sky-vision/

# Passenger entry point and package files
cp deploy/app.cjs firesky-production/app.js
cp deploy/package.production.json firesky-production/package.json

echo "  ✓ Package assembled"

# ── 5. Zip for upload ─────────────────────────────────────────────────────────
echo ""
echo "▶ Creating firesky-production.zip..."
zip -r firesky-production.zip firesky-production/ -x "*.map"
echo "  ✓ firesky-production.zip ready"

echo ""
echo "═══════════════════════════════════════════════════════"
echo "  Build complete!"
echo "  Upload firesky-production.zip to Afrihost."
echo "  See deploy/DEPLOY_GUIDE.md for next steps."
echo "═══════════════════════════════════════════════════════"
echo ""
