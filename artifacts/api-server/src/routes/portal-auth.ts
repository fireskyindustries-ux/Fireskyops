import { Router } from "express";
import { OAuth2Client } from "google-auth-library";
import { db, portalUsersTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import {
  requirePortalAuth,
  getPortalUser,
  setPortalCookie,
  PORTAL_COOKIE,
} from "../middlewares/requirePortalAuth";
import { logger } from "../lib/logger";

const router = Router();

function getCallbackUrl(req: import("express").Request): string {
  const replitDomain = process.env.REPLIT_DEV_DOMAIN ?? process.env.REPLIT_DOMAINS?.split(",")[0];
  if (replitDomain) return `https://${replitDomain}/api/portal/auth/google/callback`;
  const host = req.get("host") ?? "localhost";
  const proto = req.get("x-forwarded-proto") ?? "http";
  return `${proto}://${host}/api/portal/auth/google/callback`;
}

function getOAuthClient(redirectUri?: string) {
  const clientId = process.env.GOOGLE_CLIENT_ID ?? "";
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET ?? "";
  return new OAuth2Client(clientId, clientSecret, redirectUri);
}

router.get("/auth/google", (req, res) => {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  if (!clientId) {
    res.status(503).json({ error: "Google OAuth not configured — set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET" });
    return;
  }
  const callbackUrl = getCallbackUrl(req);
  const client = getOAuthClient(callbackUrl);
  const url = client.generateAuthUrl({
    access_type: "offline",
    scope: ["openid", "email", "profile"],
    redirect_uri: callbackUrl,
  });
  res.redirect(url);
});

router.get("/auth/google/callback", async (req, res) => {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  if (!clientId) {
    res.status(503).send("Google OAuth not configured");
    return;
  }
  const code = req.query["code"] as string | undefined;
  if (!code) {
    res.status(400).send("Missing code");
    return;
  }
  try {
    const callbackUrl = getCallbackUrl(req);
    const client = getOAuthClient(callbackUrl);
    const { tokens } = await client.getToken({ code, redirect_uri: callbackUrl });
    client.setCredentials(tokens);

    const ticket = await client.verifyIdToken({
      idToken: tokens.id_token!,
      audience: clientId,
    });
    const payload = ticket.getPayload();
    if (!payload?.sub) {
      res.status(400).send("Invalid token payload");
      return;
    }

    const googleId = payload.sub;
    const email = payload.email ?? "";
    const name = payload.name ?? email;
    const avatarUrl = payload.picture ?? null;

    const existing = await db.select().from(portalUsersTable).where(eq(portalUsersTable.googleId, googleId)).limit(1);
    let user = existing[0];
    if (!user) {
      const inserted = await db.insert(portalUsersTable).values({ googleId, email, name, avatarUrl }).returning();
      user = inserted[0]!;
    } else {
      await db.update(portalUsersTable).set({ email, name, avatarUrl }).where(eq(portalUsersTable.googleId, googleId));
    }

    setPortalCookie(res, { id: user.id, email: user.email, name: user.name, avatarUrl: user.avatarUrl });

    const basePath = req.baseUrl.replace(/\/auth\/google\/callback$/, "").replace(/\/api\/portal$/, "");
    res.redirect("/monitor/dashboard");
  } catch (err) {
    logger.error({ err }, "Google OAuth callback error");
    res.status(500).send("Authentication failed");
  }
});

// Dev-only bypass for testing without real credentials
router.get("/auth/dev-login", async (req, res) => {
  if (process.env.NODE_ENV === "production") {
    res.status(404).json({ error: "Not found" });
    return;
  }
  const googleId = "dev-test-user";
  const email = "dev@firesky.test";
  const name = "Dev User";

  const existing = await db.select().from(portalUsersTable).where(eq(portalUsersTable.googleId, googleId)).limit(1);
  let user = existing[0];
  if (!user) {
    const inserted = await db.insert(portalUsersTable).values({ googleId, email, name, avatarUrl: null }).returning();
    user = inserted[0]!;
  }

  setPortalCookie(res, { id: user.id, email, name, avatarUrl: null });
  res.redirect("/monitor/dashboard");
});

router.get("/auth/me", requirePortalAuth, (req, res) => {
  res.json(getPortalUser(req));
});

router.post("/auth/logout", (_req, res) => {
  res.clearCookie(PORTAL_COOKIE, { sameSite: "lax" });
  res.json({ ok: true });
});

export default router;
