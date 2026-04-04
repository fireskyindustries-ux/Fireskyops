import { pgTable, text, serial, timestamp, integer, real } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { customersTable } from "./customers";
import { enquiriesTable } from "./enquiries";
import { inspectionsTable } from "./inspections";

export const jobsTable = pgTable("jobs", {
  id: serial("id").primaryKey(),
  customerId: integer("customer_id").notNull().references(() => customersTable.id),
  enquiryId: integer("enquiry_id").references(() => enquiriesTable.id),
  inspectionId: integer("inspection_id").references(() => inspectionsTable.id),
  title: text("title").notNull(),
  stage: text("stage").notNull().default("enquiry"),
  priority: text("priority").notNull().default("medium"),
  tankSize: text("tank_size"),
  tankQuantity: integer("tank_quantity"),
  estimatedValue: real("estimated_value"),
  assignedToId: text("assigned_to_id"),
  notes: text("notes"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const insertJobSchema = createInsertSchema(jobsTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertJob = z.infer<typeof insertJobSchema>;
export type Job = typeof jobsTable.$inferSelect;
