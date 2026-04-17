import { pgTable, serial, integer, timestamp } from "drizzle-orm/pg-core";
import { branchesTable } from "./branches";
import { stockItemsTable } from "./stock_items";

export const stockLevelsTable = pgTable("stock_levels", {
  id: serial("id").primaryKey(),
  branchId: integer("branch_id").notNull().references(() => branchesTable.id),
  stockItemId: integer("stock_item_id").notNull().references(() => stockItemsTable.id),
  quantity: integer("quantity").notNull().default(0),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export type StockLevel = typeof stockLevelsTable.$inferSelect;
