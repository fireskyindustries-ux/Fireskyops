import { Router } from "express";
import { eq } from "drizzle-orm";
import { db, tanksTable, tankReadingsTable } from "@workspace/db";
import { logger } from "../lib/logger";

const router = Router();

// POST /api/tanks/ingest — IoT device posts readings
// Auth: x-api-key header matching FIREVISION_API_KEY env var
router.post("/tanks/ingest", async (req, res) => {
  const apiKey = process.env.FIREVISION_API_KEY;
  const provided = req.headers["x-api-key"];

  if (!apiKey) {
    logger.warn("FIREVISION_API_KEY not set — device ingest endpoint disabled");
    res.status(503).json({ error: "Device ingest not configured" });
    return;
  }
  if (provided !== apiKey) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  const {
    serial_number,
    level_cm,
    battery_percent,
    recorded_at,
    temperature_celsius,
    rainfall_mm,
    wind_speed_kmh,
    wind_direction_deg,
    pressure_hpa,
  } = req.body as {
    serial_number?: string;
    level_cm?: number;
    battery_percent?: number;
    recorded_at?: string;
    temperature_celsius?: number;
    rainfall_mm?: number;
    wind_speed_kmh?: number;
    wind_direction_deg?: number;
    pressure_hpa?: number;
  };

  if (!serial_number || level_cm === undefined || level_cm === null) {
    res.status(400).json({ error: "serial_number and level_cm are required" });
    return;
  }

  const serial = serial_number.trim().toUpperCase();
  const tanks = await db.select().from(tanksTable).where(eq(tanksTable.serialNumber, serial)).limit(1);
  const tank = tanks[0];

  if (!tank) {
    res.status(404).json({ error: "Unknown serial number" });
    return;
  }

  if (tank.isLocked) {
    res.status(403).json({ error: "Tank subscription lapsed — readings not accepted" });
    return;
  }

  const heightCm = tank.heightCm ?? 200;
  const levelPercent = Math.min(100, Math.max(0, (level_cm / heightCm) * 100));
  const litres = (levelPercent / 100) * tank.capacityLitres;

  const recordedAt = recorded_at ? new Date(recorded_at) : new Date();

  const reading = await db
    .insert(tankReadingsTable)
    .values({
      tankId: tank.id,
      levelCm: level_cm,
      levelPercent,
      litres,
      batteryPercent: battery_percent ?? null,
      temperatureCelsius: temperature_celsius ?? null,
      rainfallMm: rainfall_mm ?? null,
      windSpeedKmh: wind_speed_kmh ?? null,
      windDirectionDeg: wind_direction_deg ?? null,
      pressureHpa: pressure_hpa ?? null,
      recordedAt,
    })
    .returning();

  await db.update(tanksTable).set({ lastSeenAt: recordedAt }).where(eq(tanksTable.id, tank.id));

  logger.info({ serial, levelPercent: levelPercent.toFixed(1), litres: litres.toFixed(0) }, "Tank reading ingested");
  res.status(201).json(reading[0]);
});

export default router;
