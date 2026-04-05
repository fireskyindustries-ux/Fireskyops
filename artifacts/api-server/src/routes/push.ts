import { Router, type IRouter } from "express";
import { eq, and } from "drizzle-orm";
import { db, pushSubscriptionsTable } from "@workspace/db";
import { getVapidPublicKey } from "../lib/push";

const router: IRouter = Router();

router.get("/push/vapid-key", async (_req, res): Promise<void> => {
  const key = getVapidPublicKey();
  if (!key) {
    res.status(503).json({ error: "Push notifications not configured" });
    return;
  }
  res.json({ publicKey: key });
});

router.post("/push/subscribe", async (req, res): Promise<void> => {
  const userId = (req as any).userId;
  if (!userId) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  const { endpoint, keys } = req.body;
  if (!endpoint || !keys?.p256dh || !keys?.auth) {
    res.status(400).json({ error: "Invalid subscription object" });
    return;
  }

  await db
    .insert(pushSubscriptionsTable)
    .values({ userId, endpoint, p256dh: keys.p256dh, auth: keys.auth })
    .onConflictDoUpdate({
      target: pushSubscriptionsTable.endpoint,
      set: { userId, p256dh: keys.p256dh, auth: keys.auth },
    });

  res.json({ ok: true });
});

router.delete("/push/unsubscribe", async (req, res): Promise<void> => {
  const userId = (req as any).userId;
  const { endpoint } = req.body;

  if (!endpoint) {
    res.status(400).json({ error: "Missing endpoint" });
    return;
  }

  await db
    .delete(pushSubscriptionsTable)
    .where(
      and(
        eq(pushSubscriptionsTable.endpoint, endpoint),
        eq(pushSubscriptionsTable.userId, userId)
      )
    );

  res.json({ ok: true });
});

export default router;
