import { Router } from "express";
import { eq, and, desc, sql } from "drizzle-orm";
import { db, tanksTable, tankReadingsTable, portalSubscriptionsTable, tankSupportRequestsTable } from "@workspace/db";
import { requirePortalAuth, getPortalUser } from "../middlewares/requirePortalAuth";
import { logger } from "../lib/logger";

const router = Router();

router.use(requirePortalAuth);

// GET /api/portal/tanks — list all tanks for portal user with latest reading
router.get("/tanks", async (req, res) => {
  const user = getPortalUser(req);
  const tanks = await db
    .select()
    .from(tanksTable)
    .where(eq(tanksTable.portalUserId, user.id));

  const result = await Promise.all(
    tanks.map(async (tank) => {
      const latest = await db
        .select()
        .from(tankReadingsTable)
        .where(eq(tankReadingsTable.tankId, tank.id))
        .orderBy(desc(tankReadingsTable.recordedAt))
        .limit(1);
      return { ...tank, latestReading: latest[0] ?? null };
    }),
  );

  res.json(result);
});

// POST /api/portal/tanks/register — link a tank by serial number
router.post("/tanks/register", async (req, res) => {
  const user = getPortalUser(req);
  const { serialNumber, name } = req.body as { serialNumber?: string; name?: string };

  if (!serialNumber?.trim()) {
    res.status(400).json({ error: "serialNumber is required" });
    return;
  }

  const serial = serialNumber.trim().toUpperCase();

  const existing = await db
    .select()
    .from(tanksTable)
    .where(eq(tanksTable.serialNumber, serial))
    .limit(1);

  if (!existing[0]) {
    res.status(404).json({ error: "No device with that serial number found. Check your unit and try again." });
    return;
  }

  const tank = existing[0];

  if (tank.portalUserId && tank.portalUserId !== user.id) {
    res.status(409).json({ error: "This device is already registered to another account." });
    return;
  }

  // Check subscription limit
  const sub = await db
    .select()
    .from(portalSubscriptionsTable)
    .where(
      and(
        eq(portalSubscriptionsTable.portalUserId, user.id),
        eq(portalSubscriptionsTable.status, "active"),
      ),
    )
    .limit(1);

  const maxTanks = sub[0]?.maxTanks ?? 1;
  const currentCount = await db
    .select({ count: sql<number>`count(*)` })
    .from(tanksTable)
    .where(eq(tanksTable.portalUserId, user.id));

  if ((currentCount[0]?.count ?? 0) >= maxTanks) {
    res.status(403).json({ error: `Your current plan allows up to ${maxTanks} tank${maxTanks === 1 ? "" : "s"}. Upgrade to add more.` });
    return;
  }

  await db
    .update(tanksTable)
    .set({ portalUserId: user.id, name: name?.trim() || tank.name })
    .where(eq(tanksTable.serialNumber, serial));

  const updated = await db.select().from(tanksTable).where(eq(tanksTable.serialNumber, serial)).limit(1);
  res.json(updated[0]);
});

// GET /api/portal/tanks/:id — tank detail + reading history
router.get("/tanks/:id", async (req, res) => {
  const user = getPortalUser(req);
  const tankId = parseInt(req.params["id"] ?? "");
  if (isNaN(tankId)) { res.status(400).json({ error: "Invalid id" }); return; }

  const tank = await db.select().from(tanksTable).where(
    and(eq(tanksTable.id, tankId), eq(tanksTable.portalUserId, user.id)),
  ).limit(1);

  if (!tank[0]) { res.status(404).json({ error: "Tank not found" }); return; }

  const readings = await db
    .select()
    .from(tankReadingsTable)
    .where(eq(tankReadingsTable.tankId, tankId))
    .orderBy(desc(tankReadingsTable.recordedAt))
    .limit(200);

  res.json({ ...tank[0], readings });
});

// PATCH /api/portal/tanks/:id — rename / update alert threshold
router.patch("/tanks/:id", async (req, res) => {
  const user = getPortalUser(req);
  const tankId = parseInt(req.params["id"] ?? "");
  if (isNaN(tankId)) { res.status(400).json({ error: "Invalid id" }); return; }

  const tank = await db.select().from(tanksTable).where(
    and(eq(tanksTable.id, tankId), eq(tanksTable.portalUserId, user.id)),
  ).limit(1);
  if (!tank[0]) { res.status(404).json({ error: "Tank not found" }); return; }

  const { name, alertThresholdPercent } = req.body as { name?: string; alertThresholdPercent?: number };
  const updates: Record<string, unknown> = {};
  if (name !== undefined) updates["name"] = name.trim();
  if (alertThresholdPercent !== undefined) updates["alertThresholdPercent"] = Math.min(100, Math.max(0, alertThresholdPercent));

  await db.update(tanksTable).set(updates).where(eq(tanksTable.id, tankId));
  const updated = await db.select().from(tanksTable).where(eq(tanksTable.id, tankId)).limit(1);
  res.json(updated[0]);
});

// GET /api/portal/subscription
router.get("/subscription", async (req, res) => {
  const user = getPortalUser(req);
  const sub = await db
    .select()
    .from(portalSubscriptionsTable)
    .where(eq(portalSubscriptionsTable.portalUserId, user.id))
    .orderBy(desc(portalSubscriptionsTable.createdAt))
    .limit(1);

  const tankCount = await db
    .select({ count: sql<number>`count(*)` })
    .from(tanksTable)
    .where(eq(tanksTable.portalUserId, user.id));

  res.json({
    subscription: sub[0] ?? null,
    tanksUsed: tankCount[0]?.count ?? 0,
  });
});

// POST /api/portal/support — submit support request
router.post("/support", async (req, res) => {
  const user = getPortalUser(req);
  const { tankId, message } = req.body as { tankId?: number; message?: string };

  if (!message?.trim()) {
    res.status(400).json({ error: "message is required" });
    return;
  }
  if (!tankId) {
    res.status(400).json({ error: "tankId is required" });
    return;
  }

  const tank = await db.select().from(tanksTable).where(
    and(eq(tanksTable.id, tankId), eq(tanksTable.portalUserId, user.id)),
  ).limit(1);
  if (!tank[0]) { res.status(404).json({ error: "Tank not found" }); return; }

  const inserted = await db
    .insert(tankSupportRequestsTable)
    .values({ tankId, portalUserId: user.id, message: message.trim() })
    .returning();

  logger.info({ tankId, portalUserId: user.id }, "Support request submitted");
  res.status(201).json(inserted[0]);
});

export default router;
