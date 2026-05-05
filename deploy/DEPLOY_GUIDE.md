# Firesky Industries — Afrihost cPanel Deployment Guide

## Overview

This guide moves your app from Replit to Afrihost so it runs on your own
server at fireskyops.tech. A lapsed Replit subscription will never affect
your customers again.

**Time required:** about 30–45 minutes on first deploy. Future updates take
about 5 minutes.

---

## Before You Start — Things You Need

1. **Afrihost cPanel login** (your hosting control panel)
2. **Neon account** (free PostgreSQL database) — sign up at https://neon.tech
3. **Clerk Production keys** — from your Clerk dashboard (production instance)
4. All your other API keys (OpenAI, Resend, VAPID — already in your Replit secrets)

---

## Step 1 — Create Your Production Database (Neon)

Your current database lives inside Replit. You need to move it to Neon
(free, reliable PostgreSQL in the cloud).

1. Go to https://neon.tech and sign up / log in
2. Click **New Project** → name it `firesky-production`
3. Choose region: **Europe (Frankfurt)** or **US East** — either works
4. Once created, copy the **Connection string** — it looks like:
   `postgresql://user:password@ep-something.neon.tech/neondb?sslmode=require`
5. Save this — you will need it in Step 4

### Migrate your existing data to Neon

In Replit, open the Shell tab and run:

```bash
# Export current data from Replit's PostgreSQL
pg_dump "$DATABASE_URL" --no-owner --no-acl -Fp > firesky-backup.sql

# Import into Neon (paste your Neon connection string)
psql "postgresql://user:password@ep-something.neon.tech/neondb?sslmode=require" \
  < firesky-backup.sql
```

---

## Step 2 — Build the Production Package

In Replit's Shell tab, run:

```bash
# Set your production Clerk publishable key first
export VITE_CLERK_PUBLISHABLE_KEY="pk_live_YOUR_KEY_HERE"

# Run the build
bash deploy/build-prod.sh
```

This creates `firesky-production.zip` — a self-contained package with:
- The compiled API server
- Both React apps (Firesky + Sky Vision) as static files
- A Passenger-compatible startup file

---

## Step 3 — Set Up Clerk for Production

In your Clerk dashboard:

1. Go to your **Production** instance (not Development)
2. Under **Domains** → add `fireskyops.tech`
3. Under **API Keys** → copy `Publishable key` (pk_live_...) and `Secret key` (sk_live_...)
4. Under **JWT Templates** (or Sessions) → make sure public metadata is included
   in session tokens (this is usually on by default)

---

## Step 4 — Upload to Afrihost

1. Log in to your **Afrihost cPanel**
2. Open **File Manager**
3. Navigate to your home directory (usually `/home/yourusername/`)
4. Create a new folder called `firesky` (or use your existing node app folder)
5. Upload `firesky-production.zip` into that folder
6. Right-click the zip → **Extract** → extract into the `firesky` folder
7. The structure should look like:
   ```
   firesky/
   ├── app.js
   ├── package.json
   ├── dist/
   ├── public/
   └── public/sky-vision/
   ```

---

## Step 5 — Set Up Node.js App in cPanel

1. In cPanel, find **Setup Node.js App** (in the Software section)
2. Click **Create Application**
3. Fill in:
   - **Node.js version:** 18 or 20 (choose the highest available)
   - **Application mode:** Production
   - **Application root:** `firesky` (the folder you created)
   - **Application URL:** `fireskyops.tech` (or `/` if it's the main domain)
   - **Application startup file:** `app.js`
4. Click **Create**
5. cPanel will show a command like `source /home/.../bin/activate`. Run that
   in the cPanel Terminal to enter the app environment, then run:
   ```bash
   npm install
   ```

---

## Step 6 — Set Environment Variables

In cPanel → **Setup Node.js App** → click your app → scroll to
**Environment Variables** section. Add each variable from `deploy/.env.example`:

| Variable | Value |
|----------|-------|
| `NODE_ENV` | `production` |
| `DATABASE_URL` | Your Neon connection string from Step 1 |
| `CLERK_PUBLISHABLE_KEY` | `pk_live_...` from Clerk |
| `CLERK_SECRET_KEY` | `sk_live_...` from Clerk |
| `OPENAI_API_KEY` | Your OpenAI key |
| `RESEND_API_KEY` | Your Resend key |
| `VAPID_PUBLIC_KEY` | Your VAPID public key |
| `VAPID_PRIVATE_KEY` | Your VAPID private key |
| `VAPID_EMAIL` | `support@fireskyops.tech` |
| `SESSION_SECRET` | Any long random string |
| `LIVE_DATA_API_KEY` | `59834e2a7555d27ae745be2ff242bc9557b122b572e8cddad7ce2ba668b5f8bd` |

**Do NOT set PORT** — Passenger sets this automatically.

---

## Step 7 — Start the App

In cPanel → **Setup Node.js App** → click **Restart** (or **Start**).

Visit https://fireskyops.tech — your app should be live!

---

## Step 8 — Point Your Domain (if not already done)

If fireskyops.tech isn't already pointing to Afrihost:

1. Log in to your domain registrar (where you bought fireskyops.tech)
2. Update the **nameservers** to Afrihost's nameservers (shown in your
   Afrihost account under Domain Management)
3. DNS changes take up to 24 hours to propagate — usually much faster

---

## Updating the App in Future

When you make changes in Replit and want to deploy:

```bash
# In Replit shell:
bash deploy/build-prod.sh

# Then in Afrihost:
# 1. Upload new firesky-production.zip
# 2. Extract it (overwrite existing files)
# 3. cPanel → Setup Node.js App → Restart
```

That's it. The whole update takes about 5 minutes.

---

## Troubleshooting

**App won't start / 500 error:**
- Check the error log in cPanel → Logs → Error Log
- Make sure all environment variables are set correctly
- Confirm `npm install` ran successfully in the app directory

**Database connection error:**
- Verify your Neon DATABASE_URL is correct and includes `?sslmode=require`
- Test it: `psql "your-connection-string" -c "SELECT 1"`

**Clerk auth not working:**
- Make sure you're using `pk_live_` / `sk_live_` keys, not `pk_test_` / `sk_test_`
- Confirm `fireskyops.tech` is added as a domain in your Clerk production instance

**Sky Vision not loading:**
- Visit `https://fireskyops.tech/sky-vision/` — note the trailing slash
- Check that `public/sky-vision/index.html` exists in your app folder

---

## Need Help?

If you get stuck on any step, share the error message and which step you're
on — it can be fixed quickly.
