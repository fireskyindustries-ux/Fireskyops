import { getAuth, clerkClient } from "@clerk/express";
import { Request, Response, NextFunction } from "express";
import { logger } from "../lib/logger";

/**
 * Role hierarchy:
 *   admin        — super admin, sees all branches, full access
 *   branch_admin — branch-level admin, scoped to their branch
 *   field_worker — field staff, scoped to their branch
 *   guest        — no meaningful access
 */

function roleFromClaims(req: Request): string | null {
  const claims = (getAuth(req)?.sessionClaims as any) ?? {};
  return (
    claims?.metadata?.role ||
    claims?.public_metadata?.role ||
    null
  );
}

function branchIdFromClaims(req: Request): number | null {
  const claims = (getAuth(req)?.sessionClaims as any) ?? {};
  const raw = claims?.metadata?.branchId ?? claims?.public_metadata?.branchId;
  return raw != null ? Number(raw) : null;
}

async function metadataFromClerkApi(userId: string): Promise<{ role: string; branchId: number | null }> {
  try {
    const user = await clerkClient.users.getUser(userId);
    const role = (user.publicMetadata?.role as string) || "guest";
    const branchId = user.publicMetadata?.branchId != null ? Number(user.publicMetadata.branchId) : null;
    return { role, branchId };
  } catch {
    return { role: "guest", branchId: null };
  }
}

export function getRole(req: Request): string {
  return roleFromClaims(req) || "guest";
}

export function getBranchId(req: Request): number | null {
  return (req as any).userBranchId ?? null;
}

export function isAdmin(req: Request): boolean {
  return (req as any).userRole === "admin";
}

export function isBranchAdmin(req: Request): boolean {
  const role = (req as any).userRole;
  return role === "admin" || role === "branch_admin";
}

export function requireAuth(req: Request, res: Response, next: NextFunction) {
  const auth = getAuth(req);
  const userId = auth?.userId;
  if (!userId) {
    const hasCookie = !!(req.headers.cookie?.includes("__session") || req.headers.cookie?.includes("__client"));
    const hasBearer = !!req.headers.authorization?.startsWith("Bearer ");
    logger.warn({ path: req.path, hasCookie, hasBearer, authKeys: Object.keys(auth ?? {}) }, "[requireAuth] 401 - unauthenticated");
    return res.status(401).json({ error: "Unauthorized" });
  }
  (req as any).userId = userId;

  const claimRole = roleFromClaims(req);
  const claimBranchId = branchIdFromClaims(req);

  if (claimRole) {
    (req as any).userRole = claimRole;
    (req as any).userBranchId = claimBranchId;
    next();
    return;
  }

  metadataFromClerkApi(userId)
    .then(({ role, branchId }) => {
      (req as any).userRole = role;
      (req as any).userBranchId = branchId;
      next();
    })
    .catch(() => {
      (req as any).userRole = "guest";
      (req as any).userBranchId = null;
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

  const claimRole = roleFromClaims(req);
  if (claimRole === "admin") {
    (req as any).userId = userId;
    (req as any).userRole = "admin";
    (req as any).userBranchId = branchIdFromClaims(req);
    next();
    return;
  }

  metadataFromClerkApi(userId)
    .then(({ role, branchId }) => {
      if (role !== "admin") {
        res.status(403).json({ error: "Forbidden: admin only" });
        return;
      }
      (req as any).userId = userId;
      (req as any).userRole = "admin";
      (req as any).userBranchId = branchId;
      next();
    })
    .catch(() => {
      res.status(403).json({ error: "Forbidden" });
    });
}

export function requireBranchAdmin(req: Request, res: Response, next: NextFunction): void {
  const auth = getAuth(req);
  const userId = auth?.userId;
  if (!userId) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  const claimRole = roleFromClaims(req);
  if (claimRole === "admin" || claimRole === "branch_admin") {
    (req as any).userId = userId;
    (req as any).userRole = claimRole;
    (req as any).userBranchId = branchIdFromClaims(req);
    next();
    return;
  }

  metadataFromClerkApi(userId)
    .then(({ role, branchId }) => {
      if (role !== "admin" && role !== "branch_admin") {
        res.status(403).json({ error: "Forbidden: admin access required" });
        return;
      }
      (req as any).userId = userId;
      (req as any).userRole = role;
      (req as any).userBranchId = branchId;
      next();
    })
    .catch(() => {
      res.status(403).json({ error: "Forbidden" });
    });
}
