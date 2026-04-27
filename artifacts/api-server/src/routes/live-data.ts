import { Router } from "express";
import { db, jobsTable, enquiriesTable, customersTable, stockLevelsTable, stockItemsTable, branchesTable } from "@workspace/db";
import { eq, count } from "drizzle-orm";

const router = Router();

function requireApiKey(req: any, res: any, next: any) {
  const key = req.headers["x-api-key"];
  const expected = process.env["LIVE_DATA_API_KEY"];
  if (!expected || key !== expected) {
    return res.status(401).json({ error: "Unauthorized" });
  }
  next();
}

const INACTIVE_JOBS = ["won", "lost", "closed"];
const INACTIVE_ENQ = ["won", "lost", "closed"];

router.get("/live-data", requireApiKey, async (_req, res) => {
  try {
    const [jobs, enquiries, customers, branches, stock] = await Promise.all([
      db.select().from(jobsTable),
      db.select().from(enquiriesTable),
      db.select({ total: count() }).from(customersTable),
      db.select().from(branchesTable),
      db
        .select({
          branch: branchesTable.name,
          item: stockItemsTable.name,
          unit: stockItemsTable.unit,
          quantity: stockLevelsTable.quantity,
        })
        .from(stockLevelsTable)
        .leftJoin(stockItemsTable, eq(stockItemsTable.id, stockLevelsTable.stockItemId))
        .leftJoin(branchesTable, eq(branchesTable.id, stockLevelsTable.branchId)),
    ]);

    const activeJobs = jobs.filter((j) => !INACTIVE_JOBS.includes(j.stage));
    const activeEnquiries = enquiries.filter((e) => !INACTIVE_ENQ.includes(e.status));

    res.json({
      generated_at: new Date().toISOString(),
      summary: {
        total_customers: customers[0]?.total ?? 0,
        active_jobs: activeJobs.length,
        total_jobs: jobs.length,
        active_enquiries: activeEnquiries.length,
        total_enquiries: enquiries.length,
        branches: branches.length,
      },
      jobs_by_stage: Object.entries(
        jobs.reduce((acc: Record<string, number>, j) => {
          acc[j.stage] = (acc[j.stage] ?? 0) + 1;
          return acc;
        }, {})
      ).map(([stage, c]) => ({ stage, count: c })),
      enquiries_by_status: Object.entries(
        enquiries.reduce((acc: Record<string, number>, e) => {
          acc[e.status] = (acc[e.status] ?? 0) + 1;
          return acc;
        }, {})
      ).map(([status, c]) => ({ status, count: c })),
      branches: branches.map((b) => ({ id: b.id, name: b.name, code: b.code, active: b.isActive })),
      stock_levels: stock,
    });
  } catch (err: any) {
    res.status(500).json({ error: "Failed to fetch live data", detail: err.message });
  }
});

export default router;
