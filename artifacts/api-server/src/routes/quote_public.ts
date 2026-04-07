import { Router, type IRouter } from "express";
import { eq } from "drizzle-orm";
import { db, quotesTable, customersTable, enquiriesTable, jobsTable } from "@workspace/db";

const router: IRouter = Router();

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// ── Public: view a quote by token ──
router.get("/quote/:token", async (req, res): Promise<void> => {
  const { token } = req.params;

  if (!UUID_RE.test(token)) {
    res.status(404).json({ error: "Quote not found" });
    return;
  }

  const [quote] = await db
    .select({
      id: quotesTable.id,
      quoteToken: quotesTable.quoteToken,
      fileUrl: quotesTable.fileUrl,
      status: quotesTable.status,
      notes: quotesTable.notes,
      sentAt: quotesTable.sentAt,
      respondedAt: quotesTable.respondedAt,
      customerName: customersTable.name,
      customerContactName: customersTable.contactName,
      enquiryId: quotesTable.enquiryId,
      jobId: quotesTable.jobId,
    })
    .from(quotesTable)
    .leftJoin(customersTable, eq(quotesTable.customerId, customersTable.id))
    .where(eq(quotesTable.quoteToken, token));

  if (!quote) {
    res.status(404).json({ error: "Quote not found" });
    return;
  }

  res.json({
    ...quote,
    customerName: quote.customerContactName || quote.customerName,
  });
});

// ── Public: customer accepts a quote ──
router.post("/quote/:token/accept", async (req, res): Promise<void> => {
  const { token } = req.params;

  if (!UUID_RE.test(token)) {
    res.status(404).json({ error: "Quote not found" });
    return;
  }

  const [quote] = await db.select().from(quotesTable).where(eq(quotesTable.quoteToken, token));

  if (!quote) {
    res.status(404).json({ error: "Quote not found" });
    return;
  }

  if (quote.status !== "sent") {
    res.status(400).json({ error: "Quote already responded to" });
    return;
  }

  await db
    .update(quotesTable)
    .set({ status: "accepted", respondedAt: new Date(), updatedAt: new Date() })
    .where(eq(quotesTable.quoteToken, token));

  if (quote.enquiryId) {
    await db
      .update(enquiriesTable)
      .set({ status: "won", updatedAt: new Date() })
      .where(eq(enquiriesTable.id, quote.enquiryId));
  }

  if (quote.jobId) {
    await db
      .update(jobsTable)
      .set({ stage: "won", updatedAt: new Date() })
      .where(eq(jobsTable.id, quote.jobId));
  }

  const { notifyAdmins } = await import("../lib/notify");
  notifyAdmins(
    "Quote accepted by customer!",
    "Customer accepted the quote. Ready to confirm installation.",
    quote.enquiryId ? `/enquiries/${quote.enquiryId}` : quote.jobId ? `/jobs/${quote.jobId}` : "/jobs"
  );

  res.json({ success: true, status: "accepted" });
});

// ── Public: customer rejects a quote ──
router.post("/quote/:token/reject", async (req, res): Promise<void> => {
  const { token } = req.params;
  const { reason } = req.body;

  if (!UUID_RE.test(token)) {
    res.status(404).json({ error: "Quote not found" });
    return;
  }

  const [quote] = await db.select().from(quotesTable).where(eq(quotesTable.quoteToken, token));

  if (!quote) {
    res.status(404).json({ error: "Quote not found" });
    return;
  }

  if (quote.status !== "sent") {
    res.status(400).json({ error: "Quote already responded to" });
    return;
  }

  await db
    .update(quotesTable)
    .set({
      status: "rejected",
      respondedAt: new Date(),
      notes: reason ? `Rejected: ${reason}` : "Customer rejected the quote",
      updatedAt: new Date(),
    })
    .where(eq(quotesTable.quoteToken, token));

  const { notifyAdmins } = await import("../lib/notify");
  notifyAdmins(
    "Quote rejected by customer",
    reason || "Customer declined the quote.",
    quote.enquiryId ? `/enquiries/${quote.enquiryId}` : quote.jobId ? `/jobs/${quote.jobId}` : "/jobs"
  );

  res.json({ success: true, status: "rejected" });
});

export default router;
