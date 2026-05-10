import { pgTable, text, serial, timestamp, integer } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { tanksTable } from "./tanks";
import { portalUsersTable } from "./portal_users";

export const tankSupportRequestsTable = pgTable("tank_support_requests", {
  id: serial("id").primaryKey(),
  tankId: integer("tank_id").notNull().references(() => tanksTable.id),
  portalUserId: integer("portal_user_id").notNull().references(() => portalUsersTable.id),
  message: text("message").notNull(),
  status: text("status").notNull().default("open"), // open | resolved
  resolvedAt: timestamp("resolved_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const insertTankSupportRequestSchema = createInsertSchema(tankSupportRequestsTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertTankSupportRequest = z.infer<typeof insertTankSupportRequestSchema>;
export type TankSupportRequest = typeof tankSupportRequestsTable.$inferSelect;
