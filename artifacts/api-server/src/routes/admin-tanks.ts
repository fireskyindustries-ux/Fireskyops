import { Router } from "express";
import { eq, desc, sql } from "drizzle-orm";
import { db, tanksTable, tankReadingsTable, portalUsersTable, tankSupportRequestsTable } from "@workspace/db";
import { requireAdmin, requireBranchAdmin } from "../middlewares/requireAuth";

const router = Router();

// GET /api/admin/tanks — all tanks with latest reading (admin: all branches; branch_admin: their branch)
router.get("/admin/tanks", requireBranchAdmin, async (req, res) => {
  const tanks = await db
    .select({
      id: tanksTable.id,
      serialNumber: tanksTable.serialNumber,
      name: tanksTable.name,
      capacityLitres: tanksTable.capacityLitres,
      tankType: tanksTable.tankType,
      lat: tanksTable.lat,
      lng: tanksTable.lng,
      locationDescription: tanksTable.locationDescription,
      alertThresholdPercent: tanksTable.alertThresholdPercent,
      isLocked: tanksTable.isLocked,
      lastSeenAt: tanksTable.lastSeenAt,
      branchId: tanksTable.branchId,
      portalUserId: tanksTable.portalUserId,
      portalUserName: portalUsersTable.name,
      portalUserEmail: portalUsersTable.email,
    })
    .from(tanksTable)
    .leftJoin(portalUsersTable, eq(tanksTable.portalUserId, portalUsersTable.id));

  const result = await Promise.all(
    tanks.map(async (tank) => {
      const latest = await db
        .select()
        .from(tankReadingsTable)
        .where(eq(tankReadingsTable.tankId, tank.id))
        .orderBy(desc(tankReadingsTable.recordedAt))
        .limit(1);

      const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000);
      const isOffline = !tank.lastSeenAt || tank.lastSeenAt < twoHoursAgo;

      return {
        ...tank,
        latestReading: latest[0] ?? null,
        isOffline,
        isLowLevel: latest[0] ? latest[0].levelPercent < tank.alertThresholdPercent : false,
      };
    }),
  );

  res.json(result);
});

// GET /api/admin/tanks/alerts — summary counts for dashboard
router.get("/admin/tanks/alerts", requireBranchAdmin, async (req, res) => {
  const tanks = await db.select().from(tanksTable);
  const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000);

  let lowCount = 0;
  let offlineCount = 0;

  for (const tank of tanks) {
    if (!tank.lastSeenAt || tank.lastSeenAt < twoHoursAgo) offlineCount++;
    const latest = await db
      .select()
      .from(tankReadingsTable)
      .where(eq(tankReadingsTable.tankId, tank.id))
      .orderBy(desc(tankReadingsTable.recordedAt))
      .limit(1);
    if (latest[0] && latest[0].levelPercent < tank.alertThresholdPercent) lowCount++;
  }

  const openSupport = await db
    .select({ count: sql<number>`count(*)` })
    .from(tankSupportRequestsTable)
    .where(eq(tankSupportRequestsTable.status, "open"));

  res.json({
    totalTanks: tanks.length,
    lowLevelCount: lowCount,
    offlineCount,
    openSupportRequests: openSupport[0]?.count ?? 0,
  });
});

// GET /api/admin/tanks/:id/readings — full reading history for staff
router.get("/admin/tanks/:id/readings", requireBranchAdmin, async (req, res) => {
  const tankId = parseInt(req.params["id"] ?? "");
  if (isNaN(tankId)) { res.status(400).json({ error: "Invalid id" }); return; }

  const readings = await db
    .select()
    .from(tankReadingsTable)
    .where(eq(tankReadingsTable.tankId, tankId))
    .orderBy(desc(tankReadingsTable.recordedAt))
    .limit(500);

  res.json(readings);
});

// POST /api/admin/tanks — register a new IoT device serial (admin provisions, customer claims via portal)
router.post("/admin/tanks", requireAdmin, async (req, res) => {
  const { serialNumber, capacityLitres, heightCm, diameterCm, tankType, branchId, lat, lng, locationDescription } = req.body as {
    serialNumber?: string;
    capacityLitres?: number;
    heightCm?: number;
    diameterCm?: number;
    tankType?: string;
    branchId?: number;
    lat?: number;
    lng?: number;
    locationDescription?: string;
  };

  if (!serialNumber?.trim()) {
    res.status(400).json({ error: "serialNumber is required" });
    return;
  }

  const serial = serialNumber.trim().toUpperCase();

  const inserted = await db
    .insert(tanksTable)
    .values({
      serialNumber: serial,
      capacityLitres: capacityLitres ?? 5000,
      heightCm: heightCm ?? null,
      diameterCm: diameterCm ?? null,
      tankType: tankType ?? "vertical_round",
      branchId: branchId ?? null,
      lat: lat ?? null,
      lng: lng ?? null,
      locationDescription: locationDescription ?? null,
    })
    .returning();

  res.status(201).json(inserted[0]);
});

// GET /api/admin/support-requests — open support requests
router.get("/admin/support-requests", requireBranchAdmin, async (req, res) => {
  const requests = await db
    .select({
      id: tankSupportRequestsTable.id,
      message: tankSupportRequestsTable.message,
      status: tankSupportRequestsTable.status,
      createdAt: tankSupportRequestsTable.createdAt,
      resolvedAt: tankSupportRequestsTable.resolvedAt,
      tankId: tankSupportRequestsTable.tankId,
      tankSerial: tanksTable.serialNumber,
      tankName: tanksTable.name,
      portalUserId: tankSupportRequestsTable.portalUserId,
      portalUserName: portalUsersTable.name,
      portalUserEmail: portalUsersTable.email,
    })
    .from(tankSupportRequestsTable)
    .leftJoin(tanksTable, eq(tankSupportRequestsTable.tankId, tanksTable.id))
    .leftJoin(portalUsersTable, eq(tankSupportRequestsTable.portalUserId, portalUsersTable.id))
    .where(eq(tankSupportRequestsTable.status, "open"))
    .orderBy(desc(tankSupportRequestsTable.createdAt));

  res.json(requests);
});

export default router;
