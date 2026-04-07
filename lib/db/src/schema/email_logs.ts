import { integer, pgEnum, pgTable, serial, text, timestamp } from "drizzle-orm/pg-core";
import { customersTable } from "./customers";

export const emailTypeEnum = pgEnum("email_type", [
  "quote",
  "job_stage",
  "other",
]);

export const emailStatusEnum = pgEnum("email_status", [
  "sent",
  "failed",
]);

export const emailLogsTable = pgTable("email_logs", {
  id: serial("id").primaryKey(),
  to: text("to").notNull(),
  subject: text("subject").notNull(),
  type: emailTypeEnum("type").notNull(),
  status: emailStatusEnum("status").notNull(),
  customerId: integer("customer_id").references(() => customersTable.id),
  relatedType: text("related_type"),
  relatedId: integer("related_id"),
  resendId: text("resend_id"),
  error: text("error"),
  sentAt: timestamp("sent_at").defaultNow().notNull(),
});
