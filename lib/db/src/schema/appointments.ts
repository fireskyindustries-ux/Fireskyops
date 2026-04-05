import { pgTable, text, serial, timestamp, integer } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { jobsTable } from "./jobs";

export const appointmentsTable = pgTable("appointments", {
  id: serial("id").primaryKey(),
  jobId: integer("job_id").notNull().references(() => jobsTable.id),
  type: text("type").notNull().default("inspection"),
  title: text("title").notNull(),
  scheduledAt: timestamp("scheduled_at", { withTimezone: true }).notNull(),
  durationMinutes: integer("duration_minutes").notNull().default(120),
  travelBufferMinutes: integer("travel_buffer_minutes").notNull().default(30),
  assignedToId: text("assigned_to_id"),
  assignedToName: text("assigned_to_name"),
  notes: text("notes"),
  status: text("status").notNull().default("scheduled"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const insertAppointmentSchema = createInsertSchema(appointmentsTable).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertAppointment = z.infer<typeof insertAppointmentSchema>;
export type Appointment = typeof appointmentsTable.$inferSelect;
