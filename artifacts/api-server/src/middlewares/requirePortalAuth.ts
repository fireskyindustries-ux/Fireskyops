import { Request, Response, NextFunction } from "express";
import crypto from "crypto";

const SESSION_SECRET = process.env.SESSION_SECRET ?? "dev-secret-fallback";
export const PORTAL_COOKIE = "portal_session";

interface PortalSessionPayload {
  id: number;
  email: string;
  name: string;
  avatarUrl?: string | null;
}

export function signPortalSession(payload: PortalSessionPayload): string {
  const b64 = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const sig = crypto.createHmac("sha256", SESSION_SECRET).update(b64).digest("hex");
  return `${b64}.${sig}`;
}

export function verifyPortalSession(token: string): PortalSessionPayload | null {
  const dotIndex = token.lastIndexOf(".");
  if (dotIndex === -1) return null;
  const b64 = token.slice(0, dotIndex);
  const sig = token.slice(dotIndex + 1);
  const expected = crypto.createHmac("sha256", SESSION_SECRET).update(b64).digest("hex");
  if (sig.length !== expected.length) return null;
  try {
    if (!crypto.timingSafeEqual(Buffer.from(sig, "hex"), Buffer.from(expected, "hex"))) return null;
  } catch {
    return null;
  }
  try {
    return JSON.parse(Buffer.from(b64, "base64url").toString("utf8")) as PortalSessionPayload;
  } catch {
    return null;
  }
}

export function setPortalCookie(res: Response, payload: PortalSessionPayload): void {
  const token = signPortalSession(payload);
  res.cookie(PORTAL_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    maxAge: 30 * 24 * 60 * 60 * 1000,
    secure: process.env.NODE_ENV === "production",
  });
}

export function requirePortalAuth(req: Request, res: Response, next: NextFunction): void {
  const raw = req.cookies?.[PORTAL_COOKIE];
  if (!raw) {
    res.status(401).json({ error: "Not authenticated" });
    return;
  }
  const payload = verifyPortalSession(raw as string);
  if (!payload) {
    res.status(401).json({ error: "Invalid session" });
    return;
  }
  (req as any).portalUser = payload;
  next();
}

export function getPortalUser(req: Request): PortalSessionPayload {
  return (req as any).portalUser as PortalSessionPayload;
}
