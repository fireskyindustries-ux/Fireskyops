import { getAuth } from "@clerk/express";
import { Request, Response, NextFunction } from "express";

export function getRole(req: Request): string {
  const auth = getAuth(req);
  return (auth?.sessionClaims as any)?.metadata?.role || "guest";
}

export function requireAuth(req: Request, res: Response, next: NextFunction) {
  const auth = getAuth(req);
  const userId = auth?.userId;
  if (!userId) {
    return res.status(401).json({ error: "Unauthorized" });
  }
  (req as any).userId = userId;
  (req as any).userRole = getRole(req);
  next();
}

export function requireAdmin(req: Request, res: Response, next: NextFunction) {
  const auth = getAuth(req);
  const userId = auth?.userId;
  if (!userId) {
    return res.status(401).json({ error: "Unauthorized" });
  }
  const role = (auth?.sessionClaims as any)?.metadata?.role;
  if (role !== "admin") {
    return res.status(403).json({ error: "Forbidden: admin only" });
  }
  (req as any).userId = userId;
  (req as any).userRole = "admin";
  next();
}
