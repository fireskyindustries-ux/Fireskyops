import { Router, type IRouter } from "express";
import { eq, and, desc } from "drizzle-orm";
import { db, notificationsTable } from "@workspace/db";

const router: IRouter = Router();

router.get("/notifications", async (req, res): Promise<void> => {
  const userId = (req as any).userId;
  if (!userId) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  const rows = await db
    .select()
    .from(notificationsTable)
    .where(eq(notificationsTable.userId, userId))
    .orderBy(desc(notificationsTable.createdAt))
    .limit(50);

  res.json(rows);
});

router.patch("/notifications/:id/read", async (req, res): Promise<void> => {
  const userId = (req as any).userId;
  const id = Number(req.params.id);

  if (!id) {
    res.status(400).json({ error: "Invalid id" });
    return;
  }

  const [row] = await db
    .update(notificationsTable)
    .set({ read: true })
    .where(and(eq(notificationsTable.id, id), eq(notificationsTable.userId, userId)))
    .returning();

  if (!row) {
    res.status(404).json({ error: "Not found" });
    return;
  }

  res.json(row);
});

router.patch("/notifications/read-all", async (req, res): Promise<void> => {
  const userId = (req as any).userId;

  await db
    .update(notificationsTable)
    .set({ read: true })
    .where(eq(notificationsTable.userId, userId));

  res.json({ ok: true });
});

export default router;
