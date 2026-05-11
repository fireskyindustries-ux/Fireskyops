import { pgTable, serial, timestamp, integer, doublePrecision } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { tanksTable } from "./tanks";

export const tankReadingsTable = pgTable("tank_readings", {
  id: serial("id").primaryKey(),
  tankId: integer("tank_id").notNull().references(() => tanksTable.id),
  levelCm: doublePrecision("level_cm").notNull(),
  levelPercent: doublePrecision("level_percent").notNull(), // 0–100
  litres: doublePrecision("litres").notNull(),
  batteryPercent: integer("battery_percent"), // sensor battery 0–100
  temperatureCelsius: doublePrecision("temperature_celsius"), // ambient temp °C
  rainfallMm: doublePrecision("rainfall_mm"),               // rainfall since last reading mm
  windSpeedKmh: doublePrecision("wind_speed_kmh"),           // km/h
  windDirectionDeg: integer("wind_direction_deg"),            // 0–359 degrees
  pressureHpa: doublePrecision("pressure_hpa"),              // barometric pressure hPa
  recordedAt: timestamp("recorded_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertTankReadingSchema = createInsertSchema(tankReadingsTable).omit({ id: true });
export type InsertTankReading = z.infer<typeof insertTankReadingSchema>;
export type TankReading = typeof tankReadingsTable.$inferSelect;
