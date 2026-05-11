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
  const tankId = parseInt(String(req.params["id"] ?? ""));
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

// POST /api/admin/tanks/demo-seed — create 3 demo tanks with 7 days of realistic sensor readings
router.post("/admin/tanks/demo-seed", requireAdmin, async (req, res) => {
  const DEMO_TANKS = [
    { serial: "FS-DEMO-001", name: "Main House Tank",    capacityLitres: 5000,  heightCm: 185, startPct: 82, drift: -0.04 },
    { serial: "FS-DEMO-002", name: "Barn Tank",          capacityLitres: 2500,  heightCm: 150, startPct: 45, drift: -0.06 },
    { serial: "FS-DEMO-003", name: "Farm Reserve Tank",  capacityLitres: 10000, heightCm: 250, startPct: 18, drift: -0.02 },
  ];

  const results: string[] = [];
  const now = Date.now();
  const INTERVAL_MS = 30 * 60 * 1000; // 30 minutes
  const DAYS = 7;
  const READINGS_PER_TANK = (DAYS * 24 * 60) / 30; // 336

  // Rain event: ~3 days ago, lasts 2 hours (4 readings)
  const rainEventStart = now - 3 * 24 * 60 * 60 * 1000;

  for (const demo of DEMO_TANKS) {
    // Upsert tank
    const existing = await db.select().from(tanksTable).where(eq(tanksTable.serialNumber, demo.serial)).limit(1);
    let tank = existing[0];

    if (!tank) {
      const inserted = await db.insert(tanksTable).values({
        serialNumber: demo.serial,
        name: demo.name,
        capacityLitres: demo.capacityLitres,
        heightCm: demo.heightCm,
        tankType: "vertical_round",
        alertThresholdPercent: 20,
      }).returning();
      tank = inserted[0];
      results.push(`Created tank ${demo.serial}`);
    } else {
      await db.update(tanksTable).set({ name: demo.name, capacityLitres: demo.capacityLitres, heightCm: demo.heightCm }).where(eq(tanksTable.id, tank.id));
      results.push(`Updated tank ${demo.serial}`);
    }

    // Clear old readings
    await db.delete(tankReadingsTable).where(eq(tankReadingsTable.tankId, tank.id));

    // Generate readings
    let pct = demo.startPct;
    const readingValues = [];

    for (let i = 0; i < READINGS_PER_TANK; i++) {
      const ts = new Date(now - (READINGS_PER_TANK - i) * INTERVAL_MS);
      const tsMs = ts.getTime();
      const hourOfDay = ts.getHours() + ts.getMinutes() / 60;

      // Water level: slow decline + rain event spike
      pct += demo.drift + (Math.random() - 0.5) * 0.1;
      const isRainEvent = tsMs >= rainEventStart && tsMs < rainEventStart + 2 * 60 * 60 * 1000;
      if (isRainEvent) pct = Math.min(pct + 3.5, 100);
      pct = Math.max(0, Math.min(100, pct));

      const levelCm = (pct / 100) * demo.heightCm;
      const litres = (pct / 100) * demo.capacityLitres;

      // Temperature: sinusoidal day/night, typical SA spring
      const tempBase = 14 + 16 * Math.sin(((hourOfDay - 6) / 24) * Math.PI * 2);
      const temperatureCelsius = Math.round((tempBase + (Math.random() - 0.5) * 2) * 10) / 10;

      // Rainfall: 0 normally, spikes during rain event
      const rainfallMm = isRainEvent ? Math.round((1.5 + Math.random() * 2) * 10) / 10 : 0;

      // Wind: generally 10-25 km/h SW, gusty during rain
      const windBase = isRainEvent ? 28 + Math.random() * 15 : 10 + Math.random() * 15;
      const windSpeedKmh = Math.round(windBase * 10) / 10;
      const windDirectionDeg = Math.round(210 + (Math.random() - 0.5) * 40); // SW-ish

      // Pressure: drops before rain, recovers after
      const pressureBase = isRainEvent ? 1006 : tsMs < rainEventStart ? 1013 - (rainEventStart - tsMs) / (6 * 3600000) * 5 : 1012 + Math.random() * 4;
      const pressureHpa = Math.round(pressureBase * 10) / 10;

      // Battery: slow decline from 95% to ~80%
      const batteryPercent = Math.round(95 - (i / READINGS_PER_TANK) * 15);

      readingValues.push({
        tankId: tank.id,
        levelCm,
        levelPercent: pct,
        litres,
        batteryPercent,
        temperatureCelsius,
        rainfallMm,
        windSpeedKmh,
        windDirectionDeg,
        pressureHpa,
        recordedAt: ts,
      });
    }

    // Insert in batches of 100
    for (let b = 0; b < readingValues.length; b += 100) {
      await db.insert(tankReadingsTable).values(readingValues.slice(b, b + 100));
    }

    // Update lastSeenAt
    await db.update(tanksTable).set({ lastSeenAt: new Date() }).where(eq(tanksTable.id, tank.id));
    results.push(`Generated ${readingValues.length} readings for ${demo.serial}`);
  }

  res.json({
    message: "Demo data seeded successfully",
    details: results,
    serials: DEMO_TANKS.map(t => t.serial),
    note: "Register FS-DEMO-001, FS-DEMO-002, or FS-DEMO-003 in the Tank Monitor portal to see the demo data.",
  });
});

export default router;
