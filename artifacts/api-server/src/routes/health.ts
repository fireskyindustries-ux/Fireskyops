import { Router, type IRouter } from "express";
import { HealthCheckResponse } from "@workspace/api-zod";
import { db, branchesTable, stockLevelsTable } from "@workspace/db";

const router: IRouter = Router();

router.get("/healthz", (_req, res) => {
  const data = HealthCheckResponse.parse({ status: "ok" });
  res.json(data);
});

// Public diagnostic — no auth, confirms DB connectivity and branch data
router.get("/healthz/db", async (_req, res) => {
  try {
    const branches = await db.select().from(branchesTable);
    const levels = await db.select().from(stockLevelsTable);
    res.json({ branches, stockLevelCount: levels.length });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
