import {
  db,
  branchesTable,
  stockItemsTable,
  stockLevelsTable,
} from "@workspace/db";
import { logger } from "./logger";

const DEFAULT_BRANCH = {
  name: "The Factory",
  region: "Head Office",
};

const DEFAULT_STOCK_ITEMS = [
  { name: "Ansul Cartridge", unit: "units", category: "Suppression" },
  { name: "CO2 Cylinder 2kg", unit: "units", category: "Suppression" },
  { name: "Dry Powder Cylinder 4.5kg", unit: "units", category: "Suppression" },
  { name: "Foam Cylinder 9L", unit: "units", category: "Suppression" },
  { name: "Hose Reel", unit: "units", category: "Equipment" },
  { name: "Smoke Detector", unit: "units", category: "Detection" },
  { name: "Heat Detector", unit: "units", category: "Detection" },
  { name: "Sprinkler Head", unit: "units", category: "Suppression" },
  { name: "Fire Blanket", unit: "units", category: "Safety" },
  { name: "Emergency Light", unit: "units", category: "Safety" },
];

export async function runSeed() {
  logger.info("Running startup seed…");

  // 1. Ensure at least one branch exists
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

  // 2. Ensure default stock items exist
  const existingItems = await db.select().from(stockItemsTable);
  let itemIds: number[] = existingItems.map((i) => i.id);

  if (existingItems.length === 0) {
    logger.info("No stock items found — seeding default items");
    const inserted = await db
      .insert(stockItemsTable)
      .values(DEFAULT_STOCK_ITEMS)
      .returning();
    itemIds = inserted.map((i) => i.id);
    logger.info({ count: itemIds.length }, "Default stock items created");
  }

  // 3. Ensure stock level rows exist for every branch × item (qty defaults to 0)
  const existingLevels = await db.select().from(stockLevelsTable);
  const levelKeys = new Set(
    existingLevels.map((l) => `${l.branchId}:${l.stockItemId}`)
  );

  const missingLevels: { branchId: number; stockItemId: number }[] = [];
  for (const branchId of branchIds) {
    for (const itemId of itemIds) {
      if (!levelKeys.has(`${branchId}:${itemId}`)) {
        missingLevels.push({ branchId, stockItemId: itemId });
      }
    }
  }

  if (missingLevels.length > 0) {
    await db.insert(stockLevelsTable).values(missingLevels);
    logger.info({ count: missingLevels.length }, "Stock levels initialised");
  }

  logger.info("Startup seed complete");
}
