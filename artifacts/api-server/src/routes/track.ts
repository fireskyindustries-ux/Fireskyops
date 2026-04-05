import { Router, type IRouter } from "express";
import { eq } from "drizzle-orm";
import { db, jobsTable, customersTable } from "@workspace/db";

const router: IRouter = Router();

const STAGE_LABELS: Record<string, string> = {
  enquiry: "Enquiry received",
  inspection: "Site inspection",
  quoting: "Preparing quote",
  quoted: "Quote ready",
  won: "Installation confirmed",
  lost: "Job closed",
  closed: "Job closed",
};

const STAGE_ORDER = ["enquiry", "inspection", "quoting", "quoted", "won"];

router.get("/track/:token", async (req, res): Promise<void> => {
  const { token } = req.params;

  if (!token || token.length < 10) {
    res.status(400).json({ error: "Invalid tracking token" });
    return;
  }

  const [row] = await db
    .select({
      id: jobsTable.id,
      title: jobsTable.title,
      stage: jobsTable.stage,
      tankSize: jobsTable.tankSize,
      tankQuantity: jobsTable.tankQuantity,
      createdAt: jobsTable.createdAt,
      updatedAt: jobsTable.updatedAt,
      customerName: customersTable.name,
      customerContactName: customersTable.contactName,
    })
    .from(jobsTable)
    .leftJoin(customersTable, eq(jobsTable.customerId, customersTable.id))
    .where(eq(jobsTable.customerToken, token));

  if (!row) {
    res.status(404).json({ error: "Not found" });
    return;
  }

  const stageIndex = STAGE_ORDER.indexOf(row.stage);
  const timeline = STAGE_ORDER.map((s, i) => ({
    stage: s,
    label: STAGE_LABELS[s] || s,
    done: stageIndex >= i,
    current: row.stage === s,
  }));

  res.json({
    jobTitle: row.title,
    customerName: row.customerContactName || row.customerName,
    stage: row.stage,
    stageLabel: STAGE_LABELS[row.stage] || row.stage,
    tankSize: row.tankSize,
    tankQuantity: row.tankQuantity,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    timeline,
    isClosed: ["won", "lost", "closed"].includes(row.stage),
  });
});

export default router;
