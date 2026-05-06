import { Router, type IRouter } from "express";
import { db, customersTable, enquiriesTable } from "@workspace/db";
import { like, or, and, notInArray, sql } from "drizzle-orm";

const router: IRouter = Router();

const VALID_KEY = process.env.LIVE_DATA_API_KEY;

router.post("/cleanup-scraper-data", async (req, res): Promise<void> => {
  const key = req.headers["x-api-key"];
  if (!VALID_KEY || key !== VALID_KEY) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  const deletedEnquiries = await db
    .delete(enquiriesTable)
    .where(
      or(
        like(enquiriesTable.notes, "%Lead scraped automatically%"),
        like(enquiriesTable.notes, "%Auto-created by lead scraper%"),
      ),
    )
    .returning({ id: enquiriesTable.id });

  const deletedCustomers = await db
    .delete(customersTable)
    .where(
      and(
        like(customersTable.notes, "%Auto-created by lead scraper%"),
        notInArray(
          customersTable.id,
          sql`(SELECT DISTINCT customer_id FROM enquiries WHERE customer_id IS NOT NULL)`,
        ),
      ),
    )
    .returning({ id: customersTable.id });

  res.json({
    success: true,
    deletedEnquiries: deletedEnquiries.length,
    deletedCustomers: deletedCustomers.length,
  });
});

export default router;
