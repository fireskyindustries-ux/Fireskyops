import { Router } from "express";
import { desc, eq } from "drizzle-orm";
import { db, emailLogsTable, customersTable } from "@workspace/db";
import { requireAdmin } from "../middlewares/requireAuth";

const router = Router();

router.get("/email-logs", requireAdmin, async (req, res): Promise<void> => {
  const limit = Math.min(Number(req.query.limit) || 50, 200);

  const rows = await db
    .select({
      id: emailLogsTable.id,
      to: emailLogsTable.to,
      subject: emailLogsTable.subject,
      type: emailLogsTable.type,
      status: emailLogsTable.status,
      relatedType: emailLogsTable.relatedType,
      relatedId: emailLogsTable.relatedId,
      resendId: emailLogsTable.resendId,
      error: emailLogsTable.error,
      sentAt: emailLogsTable.sentAt,
      customerName: customersTable.name,
      customerContactName: customersTable.contactName,
    })
    .from(emailLogsTable)
    .leftJoin(customersTable, eq(emailLogsTable.customerId, customersTable.id))
    .orderBy(desc(emailLogsTable.sentAt))
    .limit(limit);

  res.json(rows.map(r => ({
    ...r,
    customerName: r.customerContactName || r.customerName || null,
  })));
});

export default router;
