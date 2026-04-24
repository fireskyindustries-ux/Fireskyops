import { eq, isNull, sql } from "drizzle-orm";
import {
  db,
  branchesTable,
  customersTable,
  enquiriesTable,
  jobsTable,
  inspectionsTable,
  stockItemsTable,
  stockLevelsTable,
  stockMovementsTable,
} from "@workspace/db";
import { logger } from "./logger";
import { brand } from "../brand.config";

const DEFAULT_BRANCH = {
  name: brand.defaultBranchName,
  region: "Head Office",
};

// Names of old placeholder items that must be replaced
const STALE_ITEM_NAMES = new Set([
  "Ansul Cartridge",
  "CO2 Cylinder 2kg",
  "Dry Powder Cylinder 4.5kg",
  "Foam Cylinder 9L",
  "Hose Reel",
  "Smoke Detector",
  "Heat Detector",
  "Sprinkler Head",
  "Fire Blanket",
  "Emergency Light",
]);

// Real Firesky inventory — name, category, unit, and opening stock quantity
const FIRESKY_STOCK_ITEMS: Array<{
  name: string;
  category: string;
  unit: string;
  openingQty: number;
}> = [
  // Tanks
  { name: "10,000lt Tank",         category: "Tanks",       unit: "units", openingQty: 4 },
  { name: "5,000lt Tank",          category: "Tanks",       unit: "units", openingQty: 5 },
  { name: "2,500lt Tank",          category: "Tanks",       unit: "units", openingQty: 6 },
  { name: "1,000lt Slimline Tank", category: "Tanks",       unit: "units", openingQty: 2 },
  // Pumps
  { name: "0.75kW Pressure Pump",  category: "Pumps",       unit: "units", openingQty: 0 },
  { name: "1.1kW Pressure Pump",   category: "Pumps",       unit: "units", openingQty: 0 },
  { name: "1.5kW Pressure Pump",   category: "Pumps",       unit: "units", openingQty: 0 },
  { name: "0.75kW VSD Pump",       category: "Pumps",       unit: "units", openingQty: 0 },
  { name: "1.5kW VSD Pump",        category: "Pumps",       unit: "units", openingQty: 0 },
  // Kits & Accessories
  { name: "25mm Suction Hose Kit", category: "Accessories", unit: "units", openingQty: 0 },
  { name: "32mm Suction Hose Kit", category: "Accessories", unit: "units", openingQty: 0 },
  { name: "Float Valve Kit",       category: "Accessories", unit: "units", openingQty: 0 },
  { name: "22mm Installation Kit 50",  category: "Accessories", unit: "units", openingQty: 0 },
  { name: "22mm Installation Kit 100", category: "Accessories", unit: "units", openingQty: 0 },
];

export async function runSeed() {
  logger.info("Running startup seed…");

  // ── 0. Enable pgvector and ensure memory chunks table exists ─────────────
  try {
    await db.execute(sql`CREATE EXTENSION IF NOT EXISTS vector`);
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS sky_memory_chunks (
        id          SERIAL PRIMARY KEY,
        user_id     TEXT NOT NULL,
        content     TEXT NOT NULL,
        embedding   vector(1536) NOT NULL,
        source      TEXT NOT NULL DEFAULT 'conversation',
        source_id   TEXT,
        created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);
    await db.execute(sql`
      CREATE INDEX IF NOT EXISTS sky_memory_chunks_user_idx
        ON sky_memory_chunks (user_id)
    `);
    logger.info("pgvector ready — sky_memory_chunks table ensured");
  } catch (err) {
    logger.warn({ err }, "pgvector setup skipped (non-fatal)");
  }

  // ── 0b. Ensure sky_diary_events table exists ──────────────────────────────
  try {
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS sky_diary_events (
        id          SERIAL PRIMARY KEY,
        user_id     TEXT NOT NULL,
        title       TEXT NOT NULL,
        description TEXT,
        start_at    TIMESTAMPTZ NOT NULL,
        end_at      TIMESTAMPTZ,
        all_day     BOOLEAN NOT NULL DEFAULT FALSE,
        type        TEXT NOT NULL DEFAULT 'event',
        status      TEXT NOT NULL DEFAULT 'scheduled',
        location    TEXT,
        color       TEXT NOT NULL DEFAULT 'orange',
        created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);
    await db.execute(sql`
      CREATE INDEX IF NOT EXISTS sky_diary_events_user_idx
        ON sky_diary_events (user_id, start_at)
    `);
    logger.info("sky_diary_events table ensured");
  } catch (err) {
    logger.warn({ err }, "sky_diary_events setup skipped (non-fatal)");
  }

  // ── 1. Ensure at least one branch exists ─────────────────────────────────
  const existingBranches = await db.select().from(branchesTable);
  let branchIds: number[] = existingBranches.map((b) => b.id);

  if (existingBranches.length === 0) {
    logger.info("No branches found — creating default branch");
    const [branch] = await db
      .insert(branchesTable)
      .values(DEFAULT_BRANCH)
      .returning();
    branchIds = [branch.id];
    logger.info({ branch }, "Default branch created");
  }

  // ── 1b. Assign any unscoped records to the primary (default) branch ───────
  const primaryBranchId = branchIds[0];
  const [cAssigned, eAssigned, jAssigned, iAssigned] = await Promise.all([
    db.update(customersTable).set({ branchId: primaryBranchId }).where(isNull(customersTable.branchId)),
    db.update(enquiriesTable).set({ branchId: primaryBranchId }).where(isNull(enquiriesTable.branchId)),
    db.update(jobsTable).set({ branchId: primaryBranchId }).where(isNull(jobsTable.branchId)),
    db.update(inspectionsTable).set({ branchId: primaryBranchId }).where(isNull(inspectionsTable.branchId)),
  ]);
  const totalFixed = (cAssigned.rowCount ?? 0) + (eAssigned.rowCount ?? 0) + (jAssigned.rowCount ?? 0) + (iAssigned.rowCount ?? 0);
  if (totalFixed > 0) {
    logger.info({ totalFixed, primaryBranchId }, "Assigned unscoped records to primary branch");
  }

  // ── 2. Detect & replace stale placeholder items ───────────────────────────
  const existingItems = await db.select().from(stockItemsTable);
  const staleItems = existingItems.filter((i) => STALE_ITEM_NAMES.has(i.name));

  if (staleItems.length > 0) {
    logger.info({ count: staleItems.length }, "Stale placeholder items detected — replacing");
    const staleIds = staleItems.map((i) => i.id);

    // Delete movements → levels → items in FK order
    for (const itemId of staleIds) {
      await db
        .delete(stockMovementsTable)
        .where(eq(stockMovementsTable.stockItemId, itemId));
      await db
        .delete(stockLevelsTable)
        .where(eq(stockLevelsTable.stockItemId, itemId));
      await db
        .delete(stockItemsTable)
        .where(eq(stockItemsTable.id, itemId));
    }
    logger.info("Stale items removed");
  }

  // ── 3. Insert correct items if not already present ────────────────────────
  const currentItems = await db.select().from(stockItemsTable);
  const currentNames = new Set(currentItems.map((i) => i.name));
  const itemsToInsert = FIRESKY_STOCK_ITEMS.filter(
    (i) => !currentNames.has(i.name)
  );

  let allItems = currentItems;
  if (itemsToInsert.length > 0) {
    logger.info({ count: itemsToInsert.length }, "Inserting new stock items");
    const inserted = await db
      .insert(stockItemsTable)
      .values(itemsToInsert.map(({ name, category, unit }) => ({ name, category, unit })))
      .returning();
    allItems = [...currentItems, ...inserted];
    logger.info("Stock items inserted");
  }

  // ── 4. Ensure stock level rows exist (set opening qty where provided) ─────
  const existingLevels = await db.select().from(stockLevelsTable);
  const levelKeys = new Set(
    existingLevels.map((l) => `${l.branchId}:${l.stockItemId}`)
  );

  // Build a name→openingQty map for quick lookup
  const openingQtyByName = new Map(
    FIRESKY_STOCK_ITEMS.map((i) => [i.name, i.openingQty])
  );

  const missingLevels: { branchId: number; stockItemId: number; quantity: number }[] = [];
  for (const branchId of branchIds) {
    for (const item of allItems) {
      if (!levelKeys.has(`${branchId}:${item.id}`)) {
        missingLevels.push({
          branchId,
          stockItemId: item.id,
          quantity: openingQtyByName.get(item.name) ?? 0,
        });
      }
    }
  }

  if (missingLevels.length > 0) {
    await db.insert(stockLevelsTable).values(missingLevels);
    logger.info({ count: missingLevels.length }, "Stock levels initialised");
  }

  logger.info("Startup seed complete");
}
