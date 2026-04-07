import { Router, type IRouter } from "express";
import { eq } from "drizzle-orm";
import {
  db, quotesTable, enquiriesTable, customersTable, jobsTable,
} from "@workspace/db";
import { logger } from "../lib/logger";

const router: IRouter = Router();

// ── Internal: create a quote (auth required, mounted under requireAuth) ──
router.post("/quotes", async (req, res): Promise<void> => {
  const { enquiryId, customerId, jobId, fileUrl, notes } = req.body;

  if (!customerId || !fileUrl) {
    res.status(400).json({ error: "customerId and fileUrl are required" });
    return;
  }

  const [quote] = await db
    .insert(quotesTable)
    .values({ enquiryId: enquiryId ?? null, customerId, jobId: jobId ?? null, fileUrl, notes: notes ?? null })
    .returning();

  // Advance enquiry status to "quoted"
  if (enquiryId) {
    await db
      .update(enquiriesTable)
      .set({ status: "quoted", updatedAt: new Date() })
      .where(eq(enquiriesTable.id, enquiryId));
  }

  // Look up customer and job for email
  const [customer] = await db
    .select()
    .from(customersTable)
    .where(eq(customersTable.id, customerId));

  let customerToken: string | null = null;
  if (jobId) {
    const [job] = await db.select().from(jobsTable).where(eq(jobsTable.id, jobId));
    customerToken = job?.customerToken ?? null;
  }

  // Send quote email to customer
  if (customer?.email) {
    try {
      const { sendQuoteEmail } = await import("../lib/email");
      await sendQuoteEmail({
        customerName: customer.contactName || customer.name,
        customerEmail: customer.email,
        quoteToken: quote.quoteToken,
        jobTitle: enquiryId ? `Enquiry #${enquiryId}` : `Job #${jobId}`,
        notes: notes ?? null,
      });
    } catch (err) {
      logger.error({ err }, "Failed to send quote email");
    }
  }

  // Notify admin team
  const { notifyAdmins } = await import("../lib/notify");
  notifyAdmins(
    `Quote sent — ${customer?.name || "Customer"}`,
    "Quote uploaded and emailed to customer",
    enquiryId ? `/enquiries/${enquiryId}` : jobId ? `/jobs/${jobId}` : "/enquiries"
  );

  res.status(201).json({
    id: quote.id,
    quoteToken: quote.quoteToken,
    status: quote.status,
    fileUrl: quote.fileUrl,
    sentAt: quote.sentAt,
    createdAt: quote.createdAt,
  });
});

// ── Internal: list quotes for an enquiry or job (auth required) ──
router.get("/quotes", async (req, res): Promise<void> => {
  const enquiryId = req.query.enquiryId ? Number(req.query.enquiryId) : null;
  const jobId = req.query.jobId ? Number(req.query.jobId) : null;

  let rows;
  if (enquiryId) {
    rows = await db.select().from(quotesTable).where(eq(quotesTable.enquiryId, enquiryId));
  } else if (jobId) {
    rows = await db.select().from(quotesTable).where(eq(quotesTable.jobId, jobId));
  } else {
    res.status(400).json({ error: "enquiryId or jobId required" });
    return;
  }

  res.json(rows);
});


export default router;
