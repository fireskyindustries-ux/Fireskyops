import { Router } from "express";
import { eq, and, desc } from "drizzle-orm";
import {
  db,
  stockItemsTable,
  stockLevelsTable,
  stockMovementsTable,
  branchesTable,
} from "@workspace/db";
import { requireAdmin, requireBranchAdmin, requireAuth, getBranchId, isAdmin } from "../middlewares/requireAuth";

const router = Router();

// ─── Stock Items (catalogue) ─────────────────────────────────────────────────

// List all stock items — any authenticated user
router.get("/items", requireAuth, async (req, res) => {
  try {
    const items = await db.select().from(stockItemsTable).orderBy(stockItemsTable.category, stockItemsTable.name);
    res.json(items);
  } catch (err) {
    console.error("stock GET /items", err);
    res.status(500).json({ error: "Failed to fetch stock items" });
  }
});

// Create stock item — admin only
router.post("/items", requireAdmin, async (req, res): Promise<void> => {
  const { name, description, unit, category } = req.body;
  if (!name) { res.status(400).json({ error: "name is required" }); return; }
  try {
    const [item] = await db.insert(stockItemsTable).values({ name, description, unit: unit || "units", category }).returning();
    res.status(201).json(item);
  } catch (err) {
    console.error("stock POST /items", err);
    res.status(500).json({ error: "Failed to create stock item" });
  }
});

// Update stock item — admin only
router.patch("/items/:id", requireAdmin, async (req, res): Promise<void> => {
  const id = Number(req.params.id);
  const { name, description, unit, category } = req.body;
  try {
    const [item] = await db
      .update(stockItemsTable)
      .set({ name, description, unit, category })
      .where(eq(stockItemsTable.id, id))
      .returning();
    if (!item) { res.status(404).json({ error: "Not found" }); return; }
    res.json(item);
  } catch (err) {
    console.error("stock PATCH /items/:id", err);
    res.status(500).json({ error: "Failed to update stock item" });
  }
});

// Delete stock item — admin only
router.delete("/items/:id", requireAdmin, async (req, res) => {
  const id = Number(req.params.id);
  try {
    await db.delete(stockItemsTable).where(eq(stockItemsTable.id, id));
    res.json({ ok: true });
  } catch (err) {
    console.error("stock DELETE /items/:id", err);
    res.status(500).json({ error: "Failed to delete stock item" });
  }
});

// ─── Stock Levels per branch ──────────────────────────────────────────────────

// Get stock levels for a specific branch
router.get("/levels/:branchId", requireAuth, async (req, res): Promise<void> => {
  const branchId = Number(req.params.branchId);
  const userBranchId = getBranchId(req);

  // Non-super-admin can only see their own branch
  if (!isAdmin(req) && userBranchId !== branchId) {
    res.status(403).json({ error: "Forbidden" }); return;
  }

  try {
    const levels = await db
      .select({
        id: stockLevelsTable.id,
        branchId: stockLevelsTable.branchId,
        stockItemId: stockLevelsTable.stockItemId,
        quantity: stockLevelsTable.quantity,
        updatedAt: stockLevelsTable.updatedAt,
        itemName: stockItemsTable.name,
        itemUnit: stockItemsTable.unit,
        itemCategory: stockItemsTable.category,
        itemDescription: stockItemsTable.description,
      })
      .from(stockLevelsTable)
      .leftJoin(stockItemsTable, eq(stockLevelsTable.stockItemId, stockItemsTable.id))
      .where(eq(stockLevelsTable.branchId, branchId))
      .orderBy(stockItemsTable.category, stockItemsTable.name);

    res.json(levels);
  } catch (err) {
    console.error("stock GET /levels/:branchId", err);
    res.status(500).json({ error: "Failed to fetch stock levels" });
  }
});

// Get stock summary across all branches — admin only
router.get("/summary", requireAdmin, async (req, res) => {
  try {
    const summary = await db
      .select({
        branchId: stockLevelsTable.branchId,
        branchName: branchesTable.name,
        stockItemId: stockLevelsTable.stockItemId,
        itemName: stockItemsTable.name,
        itemUnit: stockItemsTable.unit,
        itemCategory: stockItemsTable.category,
        quantity: stockLevelsTable.quantity,
        updatedAt: stockLevelsTable.updatedAt,
      })
      .from(stockLevelsTable)
      .leftJoin(stockItemsTable, eq(stockLevelsTable.stockItemId, stockItemsTable.id))
      .leftJoin(branchesTable, eq(stockLevelsTable.branchId, branchesTable.id))
      .orderBy(branchesTable.name, stockItemsTable.category, stockItemsTable.name);

    res.json(summary);
  } catch (err) {
    console.error("stock GET /summary", err);
    res.status(500).json({ error: "Failed to fetch stock summary" });
  }
});

// ─── Stock Movements ──────────────────────────────────────────────────────────

// Record a stock movement (in / out / adjustment)
router.post("/movements", requireBranchAdmin, async (req, res): Promise<void> => {
  const { branchId, stockItemId, type, quantity, note } = req.body;
  const userId = (req as any).userId;
  const userBranchId = getBranchId(req);

  if (!branchId || !stockItemId || !type || quantity == null) {
    res.status(400).json({ error: "branchId, stockItemId, type and quantity are required" }); return;
  }
  if (!["in", "out", "adjustment"].includes(type)) {
    res.status(400).json({ error: "type must be in, out, or adjustment" }); return;
  }
  if (!isAdmin(req) && userBranchId !== Number(branchId)) {
    res.status(403).json({ error: "Forbidden" }); return;
  }

  try {
    // Record movement
    const [movement] = await db
      .insert(stockMovementsTable)
      .values({ branchId: Number(branchId), stockItemId: Number(stockItemId), type, quantity: Number(quantity), note, userId })
      .returning();

    // Upsert stock level
    const existing = await db
      .select()
      .from(stockLevelsTable)
      .where(and(eq(stockLevelsTable.branchId, Number(branchId)), eq(stockLevelsTable.stockItemId, Number(stockItemId))));

    if (existing.length > 0) {
      let newQty = existing[0].quantity;
      if (type === "in") newQty += Number(quantity);
      else if (type === "out") newQty = Math.max(0, newQty - Number(quantity));
      else newQty = Number(quantity); // adjustment = set to value

      await db
        .update(stockLevelsTable)
        .set({ quantity: newQty })
        .where(and(eq(stockLevelsTable.branchId, Number(branchId)), eq(stockLevelsTable.stockItemId, Number(stockItemId))));
    } else {
      const initQty = type === "out" ? 0 : Number(quantity);
      await db.insert(stockLevelsTable).values({
        branchId: Number(branchId),
        stockItemId: Number(stockItemId),
        quantity: initQty,
      });
    }

    res.status(201).json(movement);
  } catch (err) {
    console.error("stock POST /movements", err);
    res.status(500).json({ error: "Failed to record stock movement" });
  }
});

// Get movement history for a branch
router.get("/movements/:branchId", requireAuth, async (req, res): Promise<void> => {
  const branchId = Number(req.params.branchId);
  const userBranchId = getBranchId(req);

  if (!isAdmin(req) && userBranchId !== branchId) {
    res.status(403).json({ error: "Forbidden" }); return;
  }

  try {
    const movements = await db
      .select({
        id: stockMovementsTable.id,
        branchId: stockMovementsTable.branchId,
        stockItemId: stockMovementsTable.stockItemId,
        type: stockMovementsTable.type,
        quantity: stockMovementsTable.quantity,
        note: stockMovementsTable.note,
        userId: stockMovementsTable.userId,
        createdAt: stockMovementsTable.createdAt,
        itemName: stockItemsTable.name,
        itemUnit: stockItemsTable.unit,
      })
      .from(stockMovementsTable)
      .leftJoin(stockItemsTable, eq(stockMovementsTable.stockItemId, stockItemsTable.id))
      .where(eq(stockMovementsTable.branchId, branchId))
      .orderBy(desc(stockMovementsTable.createdAt))
      .limit(200);

    res.json(movements);
  } catch (err) {
    console.error("stock GET /movements/:branchId", err);
    res.status(500).json({ error: "Failed to fetch movements" });
  }
});

export default router;
