import { pgTable, text, serial, timestamp, integer, real, boolean, date } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { customersTable } from "./customers";
import { enquiriesTable } from "./enquiries";
import { inspectionsTable } from "./inspections";
import { branchesTable } from "./branches";

export const jobsTable = pgTable("jobs", {
  id: serial("id").primaryKey(),
  branchId: integer("branch_id").references(() => branchesTable.id),
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
  jobType: text("job_type").notNull().default("full_install"),
  notes: text("notes"),
  nextAction: text("next_action"),
  nextActionDate: date("next_action_date"),
  followUpDueDate: date("follow_up_due_date"),
  quoteSentDate: date("quote_sent_date"),
  lostReason: text("lost_reason"),
  accessRisk: text("access_risk"),
  customerToken: text("customer_token").default(sql`gen_random_uuid()`),
  notificationsEnabled: boolean("notifications_enabled").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const insertJobSchema = createInsertSchema(jobsTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertJob = z.infer<typeof insertJobSchema>;
export type Job = typeof jobsTable.$inferSelect;
