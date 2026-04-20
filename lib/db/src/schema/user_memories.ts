import { pgTable, serial, text, timestamp } from "drizzle-orm/pg-core";

export const userMemories = pgTable("user_memories", {
  id: serial("id").primaryKey(),
  userId: text("user_id").notNull().unique(),
  content: text("content").notNull().default(""),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

export type UserMemory = typeof userMemories.$inferSelect;
