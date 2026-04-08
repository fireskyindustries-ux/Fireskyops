import { Router } from "express";
import { requireAdmin } from "../middlewares/requireAuth";
import { sql } from "drizzle-orm";
import { db } from "@workspace/db";

const router = Router();

router.post("/admin/reset-data", requireAdmin, async (req, res): Promise<void> => {
  await db.execute(sql`
    TRUNCATE TABLE
      email_logs,
      push_subscriptions,
      notifications,
      messages,
      conversations,
      appointments,
      quotes,
      job_loads,
      jobs,
      inspections,
      enquiries,
      customers
    RESTART IDENTITY CASCADE
  `);
  res.json({ success: true, message: "All data cleared." });
});

export default router;
