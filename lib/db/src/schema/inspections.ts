import { pgTable, text, serial, timestamp, integer, boolean, real } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { customersTable } from "./customers";
import { enquiriesTable } from "./enquiries";
import { branchesTable } from "./branches";

export const inspectionsTable = pgTable("inspections", {
  id: serial("id").primaryKey(),
  branchId: integer("branch_id").references(() => branchesTable.id),
  enquiryId: integer("enquiry_id").references(() => enquiriesTable.id),
  customerId: integer("customer_id").notNull().references(() => customersTable.id),
  farmName: text("farm_name"),
  nearestTown: text("nearest_town"),
  manualDirections: text("manual_directions"),
  landmarks: text("landmarks"),
  whatsappLocation: text("whatsapp_location"),
  accessNotes: text("access_notes"),
  tankSize: text("tank_size"),
  tankQuantity: integer("tank_quantity"),
  requiresStand: boolean("requires_stand").default(false),
  requiresPlinth: boolean("requires_plinth").default(false),
  standHeight: text("stand_height"),
  plinthDetails: text("plinth_details"),
  pipeLength: real("pipe_length"),
  pipeDetails: text("pipe_details"),
  distanceFromRoad: real("distance_from_road"),
  distanceFromHouse: real("distance_from_house"),
  truckAccess: boolean("truck_access").default(false),
  trailerAccess: boolean("trailer_access").default(false),
  offloadingConstraints: text("offloading_constraints"),
  groundCondition: text("ground_condition"),
  siteReadyToQuote: boolean("site_ready_to_quote").default(false),
  assignedToId: text("assigned_to_id"),
  photoUrls: text("photo_urls").array(),
  notes: text("notes"),
  inspectedAt: timestamp("inspected_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const insertInspectionSchema = createInsertSchema(inspectionsTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertInspection = z.infer<typeof insertInspectionSchema>;
export type Inspection = typeof inspectionsTable.$inferSelect;
