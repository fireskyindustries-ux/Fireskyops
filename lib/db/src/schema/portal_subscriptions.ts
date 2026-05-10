import { pgTable, text, serial, timestamp, integer, numeric } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { portalUsersTable } from "./portal_users";

export const portalSubscriptionsTable = pgTable("portal_subscriptions", {
  id: serial("id").primaryKey(),
  portalUserId: integer("portal_user_id").notNull().references(() => portalUsersTable.id),
  tier: text("tier").notNull().default("basic"), // basic | pro | enterprise
  maxTanks: integer("max_tanks").notNull().default(1),
  priceZar: numeric("price_zar", { precision: 10, scale: 2 }).notNull().default("99.00"),
  payfastSubscriptionId: text("payfast_subscription_id"),
  payfastToken: text("payfast_token"),
  status: text("status").notNull().default("pending"), // pending | active | cancelled | lapsed
  nextBillingDate: timestamp("next_billing_date", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const insertPortalSubscriptionSchema = createInsertSchema(portalSubscriptionsTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertPortalSubscription = z.infer<typeof insertPortalSubscriptionSchema>;
export type PortalSubscription = typeof portalSubscriptionsTable.$inferSelect;
