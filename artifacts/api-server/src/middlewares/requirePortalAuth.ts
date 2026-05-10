import { Request, Response, NextFunction } from "express";
import { getAuth, clerkClient } from "@clerk/express";
import { db, portalUsersTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { logger } from "../lib/logger";

export interface PortalSessionPayload {
  id: number;
  email: string;
  name: string;
  avatarUrl?: string | null;
  clerkUserId: string;
}

export async function requirePortalAuth(req: Request, res: Response, next: NextFunction): Promise<void> {
  const { userId } = getAuth(req);
  if (!userId) {
    res.status(401).json({ error: "Not authenticated" });
    return;
  }

  try {
    const existing = await db
      .select()
      .from(portalUsersTable)
      .where(eq(portalUsersTable.clerkUserId, userId))
      .limit(1);

    let portalUser = existing[0];

    if (!portalUser) {
      const clerkUser = await clerkClient.users.getUser(userId);
      const email = clerkUser.emailAddresses[0]?.emailAddress ?? "";
      const name =
        [clerkUser.firstName, clerkUser.lastName].filter(Boolean).join(" ").trim() || email;
      const avatarUrl = clerkUser.imageUrl || null;

      const inserted = await db
        .insert(portalUsersTable)
        .values({ clerkUserId: userId, email, name, avatarUrl })
        .returning();
      portalUser = inserted[0]!;
      logger.info({ userId, email }, "Portal user auto-created from Clerk");
    }

    (req as any).portalUser = {
      id: portalUser.id,
      email: portalUser.email,
      name: portalUser.name,
      avatarUrl: portalUser.avatarUrl,
      clerkUserId: portalUser.clerkUserId,
    } satisfies PortalSessionPayload;

    next();
  } catch (err) {
    logger.error({ err }, "requirePortalAuth error");
    res.status(500).json({ error: "Auth error" });
  }
}

export function getPortalUser(req: Request): PortalSessionPayload {
  return (req as any).portalUser as PortalSessionPayload;
}
