import { pgTable, serial, text, timestamp } from "drizzle-orm/pg-core";

export const savedPrompts = pgTable("saved_prompts", {
  id: serial("id").primaryKey(),
  userId: text("user_id").notNull(),
  title: text("title").notNull(),
  content: text("content").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export type SavedPrompt = typeof savedPrompts.$inferSelect;
