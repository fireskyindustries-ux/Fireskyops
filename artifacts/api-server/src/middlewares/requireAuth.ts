import { getAuth, clerkClient } from "@clerk/express";
import { Request, Response, NextFunction } from "express";

/**
 * Extract role from session claims — fast path.
 * Works when the Clerk JWT template includes: { "metadata": "{{user.public_metadata}}" }
 */
function roleFromClaims(req: Request): string | null {
  const claims = (getAuth(req)?.sessionClaims as any) ?? {};
  return (
    claims?.metadata?.role ||
    claims?.public_metadata?.role ||
    null
  );
}

/**
 * Fetch role from the Clerk backend API — slow but always accurate.
 * Used as a fallback when no JWT template is configured.
 */
async function roleFromClerkApi(userId: string): Promise<string> {
  try {
    const user = await clerkClient.users.getUser(userId);
    return (user.publicMetadata?.role as string) || "guest";
  } catch {
    return "guest";
  }
}

export function getRole(req: Request): string {
  return roleFromClaims(req) || "guest";
}

export function requireAuth(req: Request, res: Response, next: NextFunction) {
  const auth = getAuth(req);
  const userId = auth?.userId;
  if (!userId) {
    return res.status(401).json({ error: "Unauthorized" });
  }
  (req as any).userId = userId;

  // Fast path: role already embedded in JWT claims
  const claimRole = roleFromClaims(req);
  if (claimRole) {
    (req as any).userRole = claimRole;
    next();
    return;
  }

  // Slow path: JWT template not configured — fetch role from Clerk API
  roleFromClerkApi(userId)
    .then((role) => {
      (req as any).userRole = role;
      next();
    })
    .catch(() => {
      (req as any).userRole = "guest";
      next();
    });
}

export function requireAdmin(req: Request, res: Response, next: NextFunction): void {
  const auth = getAuth(req);
  const userId = auth?.userId;
  if (!userId) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  // Fast path: role already in JWT claims (no extra network call)
  const claimRole = roleFromClaims(req);
  if (claimRole === "admin") {
    (req as any).userId = userId;
    (req as any).userRole = "admin";
    next();
    return;
  }

  // Slow path: claims not set (JWT template not configured) — verify via Clerk API
  roleFromClerkApi(userId)
    .then((role) => {
      if (role !== "admin") {
        res.status(403).json({ error: "Forbidden: admin only" });
        return;
      }
      (req as any).userId = userId;
      (req as any).userRole = "admin";
      next();
    })
    .catch(() => {
      res.status(403).json({ error: "Forbidden" });
    });
}
