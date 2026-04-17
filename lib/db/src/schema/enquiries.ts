import { pgTable, text, serial, timestamp, integer, date } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { customersTable } from "./customers";
import { branchesTable } from "./branches";

export const enquiriesTable = pgTable("enquiries", {
  id: serial("id").primaryKey(),
  branchId: integer("branch_id").references(() => branchesTable.id),
  customerId: integer("customer_id").notNull().references(() => customersTable.id),
  title: text("title").notNull(),
  description: text("description"),
  tankSize: text("tank_size"),
  tankQuantity: integer("tank_quantity"),
  status: text("status").notNull().default("new"),
  priority: text("priority").notNull().default("medium"),
  notes: text("notes"),
  nextAction: text("next_action"),
  nextActionDate: date("next_action_date"),
  followUpDueDate: date("follow_up_due_date"),
  assignedStaff: text("assigned_staff"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const insertEnquirySchema = createInsertSchema(enquiriesTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertEnquiry = z.infer<typeof insertEnquirySchema>;
export type Enquiry = typeof enquiriesTable.$inferSelect;
