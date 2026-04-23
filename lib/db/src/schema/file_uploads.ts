import { pgTable, text, serial, timestamp, integer } from "drizzle-orm/pg-core";

export const fileUploadsTable = pgTable("file_uploads", {
  id: serial("id").primaryKey(),
  fileData: text("file_data").notNull(),
  contentType: text("content_type").notNull().default("application/octet-stream"),
  fileName: text("file_name"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export type FileUpload = typeof fileUploadsTable.$inferSelect;
