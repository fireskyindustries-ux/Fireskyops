import { Router, type IRouter } from "express";
import { eq } from "drizzle-orm";
import {
  db, quotesTable, enquiriesTable, customersTable,
} from "@workspace/db";

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

  // Look up customer for notification
  const [customer] = await db
    .select()
    .from(customersTable)
    .where(eq(customersTable.id, customerId));

  // Notify admin team — quote is sent via WhatsApp by the field agent
  const { notifyAdmins } = await import("../lib/notify");
  notifyAdmins(
    `Quote uploaded — ${customer?.name || "Customer"}`,
    "Quote PDF uploaded. Send the link to the customer via WhatsApp.",
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

// ── Internal: replace an existing quote (auth required) ──
router.put("/quotes/:id", async (req, res): Promise<void> => {
  const id = Number(req.params.id);
  if (!id) { res.status(400).json({ error: "Invalid id" }); return; }

  const { fileUrl, notes, resendEmail } = req.body;
  if (!fileUrl) { res.status(400).json({ error: "fileUrl is required" }); return; }

  const [existing] = await db.select().from(quotesTable).where(eq(quotesTable.id, id));
  if (!existing) { res.status(404).json({ error: "Quote not found" }); return; }

  const [quote] = await db
    .update(quotesTable)
    .set({
      fileUrl,
      notes: notes ?? existing.notes,
      status: "sent",
      respondedAt: null,
      sentAt: new Date(),
      updatedAt: new Date(),
    })
    .where(eq(quotesTable.id, id))
    .returning();

  // Notify admin — quote is sent to customer via WhatsApp by the field agent
  const [customer] = await db.select().from(customersTable).where(eq(customersTable.id, existing.customerId));
  const { notifyAdmins } = await import("../lib/notify");
  notifyAdmins(
    `Quote replaced — ${existing.enquiryId ? `Enquiry #${existing.enquiryId}` : `Job #${existing.jobId}`}`,
    "Quote PDF replaced. Send the updated link to the customer via WhatsApp.",
    existing.enquiryId ? `/enquiries/${existing.enquiryId}` : existing.jobId ? `/jobs/${existing.jobId}` : "/enquiries"
  );

  res.json({ id: quote.id, quoteToken: quote.quoteToken, status: quote.status, fileUrl: quote.fileUrl, sentAt: quote.sentAt });
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
