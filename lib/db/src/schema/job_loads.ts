import { pgTable, text, serial, timestamp, integer } from "drizzle-orm/pg-core";
import { jobsTable } from "./jobs";

export const jobLoadsTable = pgTable("job_loads", {
  id: serial("id").primaryKey(),
  jobId: integer("job_id").notNull().references(() => jobsTable.id, { onDelete: "cascade" }),
  loadNumber: integer("load_number").notNull(),
  status: text("status").notNull().default("pending"),
  scheduledDate: timestamp("scheduled_date", { withTimezone: true }),
  deliveredAt: timestamp("delivered_at", { withTimezone: true }),
  tankSize: text("tank_size"),
  tankQuantity: integer("tank_quantity"),
  driverName: text("driver_name"),
  vehicleReg: text("vehicle_reg"),
  notes: text("notes"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export type JobLoad = typeof jobLoadsTable.$inferSelect;
