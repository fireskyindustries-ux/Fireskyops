import { pgTable, serial, text, timestamp, boolean } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const skyDiaryEvents = pgTable("sky_diary_events", {
  id: serial("id").primaryKey(),
  userId: text("user_id").notNull(),
  title: text("title").notNull(),
  description: text("description"),
  startAt: timestamp("start_at", { withTimezone: true }).notNull(),
  endAt: timestamp("end_at", { withTimezone: true }),
  allDay: boolean("all_day").notNull().default(false),
  type: text("type").notNull().default("event"),
  status: text("status").notNull().default("scheduled"),
  location: text("location"),
  color: text("color").notNull().default("orange"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertSkyDiaryEventSchema = createInsertSchema(skyDiaryEvents).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type SkyDiaryEvent = typeof skyDiaryEvents.$inferSelect;
export type InsertSkyDiaryEvent = z.infer<typeof insertSkyDiaryEventSchema>;
