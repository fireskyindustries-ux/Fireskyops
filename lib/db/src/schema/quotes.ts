import { integer, pgEnum, pgTable, serial, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { enquiriesTable } from "./enquiries";
import { customersTable } from "./customers";
import { jobsTable } from "./jobs";

export const quoteStatusEnum = pgEnum("quote_status", [
  "draft",
  "sent",
  "accepted",
  "rejected",
]);

export const quotesTable = pgTable("quotes", {
  id: serial("id").primaryKey(),
  quoteToken: uuid("quote_token").default(sql`gen_random_uuid()`).notNull().unique(),
  enquiryId: integer("enquiry_id").references(() => enquiriesTable.id),
  customerId: integer("customer_id").references(() => customersTable.id).notNull(),
  jobId: integer("job_id").references(() => jobsTable.id),
  fileUrl: text("file_url").notNull(),
  status: quoteStatusEnum("status").default("sent").notNull(),
  notes: text("notes"),
  sentAt: timestamp("sent_at").defaultNow(),
  respondedAt: timestamp("responded_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});
