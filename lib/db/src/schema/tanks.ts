import { pgTable, text, serial, timestamp, integer, doublePrecision, boolean } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { portalUsersTable } from "./portal_users";
import { branchesTable } from "./branches";

export const tanksTable = pgTable("tanks", {
  id: serial("id").primaryKey(),
  serialNumber: text("serial_number").notNull().unique(),
  portalUserId: integer("portal_user_id").references(() => portalUsersTable.id),
  branchId: integer("branch_id").references(() => branchesTable.id),
  name: text("name"), // customer-given name e.g. "Barn Tank"
  capacityLitres: integer("capacity_litres").notNull().default(5000),
  heightCm: integer("height_cm"), // tank height for level calculation
  diameterCm: integer("diameter_cm"),
  tankType: text("tank_type").notNull().default("vertical_round"), // vertical_round | horizontal | rectangular
  lat: doublePrecision("lat"),
  lng: doublePrecision("lng"),
  locationDescription: text("location_description"),
  alertThresholdPercent: integer("alert_threshold_percent").notNull().default(20),
  isLocked: boolean("is_locked").notNull().default(false), // locked if subscription lapses
  lastSeenAt: timestamp("last_seen_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const insertTankSchema = createInsertSchema(tanksTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertTank = z.infer<typeof insertTankSchema>;
export type Tank = typeof tanksTable.$inferSelect;
