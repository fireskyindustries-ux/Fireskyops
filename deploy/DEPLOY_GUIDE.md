# Firesky Industries — Afrihost cPanel Deployment Guide

## Overview

This guide moves your app from Replit to Afrihost so it runs permanently at
fireskyops.tech. Your Afrihost plan has PostgreSQL built in, so everything
(app + database) lives on the same server — no third-party services needed.

**Time required:** about 30–45 minutes on first deploy. Future updates take
about 5 minutes.

---

## Before You Start — Things You Need

1. **Afrihost cPanel login**
2. **Clerk Production keys** — from your Clerk dashboard (production instance)
3. Your API keys (OpenAI, Resend, VAPID) — already saved in your Replit secrets

---

## Step 1 — Create the PostgreSQL Database on Afrihost

1. Log in to **Afrihost cPanel**
2. Under **Databases**, click **PostgreSQL Database Wizard**
3. **Step 1 — Create Database:** enter a name, e.g. `firesky` → click Next
4. **Step 2 — Create User:** enter a username, e.g. `fireskyuser`, and a strong
   password → click Next
5. **Step 3 — Assign User:** tick **ALL PRIVILEGES** → click Next
6. Done. Note down:
   - Database name (cPanel prefixes it with your account name, e.g. `cpaneluser_firesky`)
   - Username (e.g. `cpaneluser_fireskyuser`)
   - Password you chose

Your DATABASE_URL will be:
```
postgresql://cpaneluser_fireskyuser:yourpassword@localhost/cpaneluser_firesky
```
(Replace the username, password and db name with yours — all on localhost, no SSL needed.)

---

## Step 2 — Migrate Your Data from Replit to Afrihost

You need to copy the existing database from Replit to Afrihost.

### 2a — Export from Replit

In Replit's Shell tab, run:

```bash
pg_dump "$DATABASE_URL" --no-owner --no-acl -Fp > firesky-backup.sql
echo "Export done — $(wc -l < firesky-backup.sql) lines"
```

This creates `firesky-backup.sql` in your project root.

### 2b — Get the SQL file to Afrihost

The easiest method is to upload `firesky-backup.sql` via cPanel File Manager:

1. In **cPanel → File Manager**, navigate to your home directory
2. Click **Upload** and upload `firesky-backup.sql`

### 2c — Import into Afrihost PostgreSQL

In **cPanel → Terminal** (or SSH into your server), run:

```bash
psql -U cpaneluser_fireskyuser -d cpaneluser_firesky -h localhost < ~/firesky-backup.sql
```

Enter your database password when prompted.

To verify it worked:
```bash
psql -U cpaneluser_fireskyuser -d cpaneluser_firesky -h localhost -c "\dt"
```
You should see all your tables listed (branches, customers, jobs, stock_items, etc.)

---

## Step 3 — Build the Production Package

In Replit's **Shell** tab, run:

```bash
# Paste your PRODUCTION Clerk publishable key (pk_live_... from Clerk dashboard)
export VITE_CLERK_PUBLISHABLE_KEY="pk_live_YOUR_KEY_HERE"

bash deploy/build-prod.sh
```

This creates `firesky-production.zip` containing:
- The compiled API server
- Both React apps (Firesky + Sky Vision) as static files
- The Passenger-compatible `app.js` startup file

---

## Step 4 — Set Up Clerk for Production

In your Clerk dashboard:

1. Switch to your **Production** instance (not Development)
2. Under **Domains** → add `fireskyops.tech`
3. Under **API Keys** → copy the `Publishable key` (pk_live_...) and `Secret key` (sk_live_...)
4. Keep the Secret key safe — you'll paste it in Step 6

---

## Step 5 — Upload the App to Afrihost

1. In **cPanel → File Manager**, navigate to your home directory
2. Create a folder called `firesky` (e.g. `/home/yourusername/firesky/`)
3. Upload `firesky-production.zip` into that folder
4. Right-click the zip → **Extract** → extract here
5. The result should look like:
   ```
   firesky/
   ├── app.js          ← Passenger startup file
   ├── package.json
   ├── dist/           ← compiled API server
   ├── public/         ← Firesky static app
   └── public/
       └── sky-vision/ ← Sky Vision static app
   ```

---

## Step 6 — Set Up the Node.js App in cPanel

1. In cPanel, find **Setup Node.js App** (Software section)
2. Click **Create Application**
3. Fill in:
   - **Node.js version:** 18 or 20 (pick the highest available)
   - **Application mode:** Production
   - **Application root:** `firesky`
   - **Application URL:** `/` (root — this is your main domain)
   - **Application startup file:** `app.js`
4. Click **Create**
5. cPanel shows a command like:
   ```
   source /home/yourusername/nodevenv/firesky/20/bin/activate && cd /home/yourusername/firesky
   ```
   Copy and paste that into **cPanel → Terminal**, then run:
   ```bash
   npm install
   ```

---

## Step 7 — Set Environment Variables

In cPanel → **Setup Node.js App** → click your `firesky` app → scroll to
**Environment Variables**. Add each one:

| Variable | Value |
|----------|-------|
| `NODE_ENV` | `production` |
| `DATABASE_URL` | `postgresql://cpaneluser_fireskyuser:password@localhost/cpaneluser_firesky` |
| `CLERK_PUBLISHABLE_KEY` | `pk_live_...` from Step 4 |
| `CLERK_SECRET_KEY` | `sk_live_...` from Step 4 |
| `OPENAI_API_KEY` | Your OpenAI key |
| `RESEND_API_KEY` | Your Resend key |
| `VAPID_PUBLIC_KEY` | Your VAPID public key |
| `VAPID_PRIVATE_KEY` | Your VAPID private key |
| `VAPID_EMAIL` | `support@fireskyops.tech` |
| `SESSION_SECRET` | Any long random string (run `openssl rand -hex 32` in cPanel Terminal) |
| `LIVE_DATA_API_KEY` | `59834e2a7555d27ae745be2ff242bc9557b122b572e8cddad7ce2ba668b5f8bd` |

**Do NOT add PORT** — Passenger sets this automatically.

Click **Save** after adding all variables.

---

## Step 8 — Start the App

In cPanel → **Setup Node.js App** → click **Restart** on your firesky app.

Visit **https://fireskyops.tech** — your app should be live!

---

## Step 9 — Point Your Domain (if not already done)

If fireskyops.tech is not already hosted on Afrihost:

1. Log in to wherever you bought the domain
2. Update the **nameservers** to Afrihost's nameservers (shown in your
   Afrihost control panel under Domain Management)
3. DNS changes can take up to 24 hours — usually within an hour

If the domain is already on Afrihost, it will just work after Step 8.

---

## Updating the App in Future

Whenever you make changes in Replit:

```bash
# 1. In Replit shell — rebuild:
export VITE_CLERK_PUBLISHABLE_KEY="pk_live_YOUR_KEY_HERE"
bash deploy/build-prod.sh

# 2. Upload the new firesky-production.zip to Afrihost
# 3. Extract it (overwrite existing files) in File Manager
# 4. cPanel → Setup Node.js App → Restart
```

Total time: about 5 minutes.

---

## Troubleshooting

**App won't start / blank page:**
- cPanel → Logs → Error Log — this shows the exact error
- Make sure all environment variables are saved
- Confirm `npm install` ran successfully

**Database connection error:**
- Double-check the DATABASE_URL — username and database name are prefixed
  with your cPanel account name (e.g. `cpaneluser_firesky`, not just `firesky`)
- Test in cPanel Terminal:
  ```bash
  psql -U cpaneluser_fireskyuser -d cpaneluser_firesky -h localhost -c "SELECT 1"
  ```

**Clerk auth not working:**
- Make sure you're using the `pk_live_` / `sk_live_` keys, not `pk_test_` / `sk_test_`
- Confirm `fireskyops.tech` is added in your Clerk Production instance domains

**Sky Vision loads the wrong page:**
- Visit `https://fireskyops.tech/sky-vision/` — the trailing slash matters
- Check that `public/sky-vision/index.html` exists inside your `firesky` folder

**Push notifications not working:**
- Confirm `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, and `VAPID_EMAIL` are all set
- Re-subscribe on the device after first production login (subscriptions are
  tied to the server's VAPID keys)

---

## Need Help?

Share the exact error message and which step you're on — it can be fixed quickly.
