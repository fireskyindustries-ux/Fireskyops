import { Router, type IRouter } from "express";
import { eq } from "drizzle-orm";
import { db, enquiriesTable, customersTable, inspectionsTable, jobsTable, quotesTable } from "@workspace/db";
import {
  ListEnquiriesQueryParams,
  ListEnquiriesResponse,
  CreateEnquiryBody,
  GetEnquiryParams,
  GetEnquiryResponse,
  UpdateEnquiryParams,
  UpdateEnquiryBody,
  UpdateEnquiryResponse,
} from "@workspace/api-zod";
import { notifyAdmins } from "../lib/notify";

const router: IRouter = Router();

router.get("/enquiries", async (req, res): Promise<void> => {
  const query = ListEnquiriesQueryParams.safeParse(req.query);
  if (!query.success) {
    res.status(400).json({ error: query.error.message });
    return;
  }

  let rows = await db
    .select({
      id: enquiriesTable.id,
      customerId: enquiriesTable.customerId,
      customerName: customersTable.name,
      title: enquiriesTable.title,
      description: enquiriesTable.description,
      tankSize: enquiriesTable.tankSize,
      tankQuantity: enquiriesTable.tankQuantity,
      status: enquiriesTable.status,
      priority: enquiriesTable.priority,
      notes: enquiriesTable.notes,
      nextAction: enquiriesTable.nextAction,
      nextActionDate: enquiriesTable.nextActionDate,
      followUpDueDate: enquiriesTable.followUpDueDate,
      assignedStaff: enquiriesTable.assignedStaff,
      createdAt: enquiriesTable.createdAt,
      updatedAt: enquiriesTable.updatedAt,
    })
    .from(enquiriesTable)
    .leftJoin(customersTable, eq(enquiriesTable.customerId, customersTable.id))
    .orderBy(enquiriesTable.createdAt);

  if (query.data.customerId) {
    rows = rows.filter((r) => r.customerId === query.data.customerId);
  }
  if (query.data.status) {
    rows = rows.filter((r) => r.status === query.data.status);
  }

  const normalized = rows.map((r) => ({
    ...r,
    customerName: r.customerName ?? undefined,
    description: r.description ?? undefined,
    tankSize: r.tankSize ?? undefined,
    tankQuantity: r.tankQuantity ?? undefined,
    notes: r.notes ?? undefined,
    nextAction: r.nextAction ?? undefined,
    nextActionDate: r.nextActionDate ?? undefined,
    followUpDueDate: r.followUpDueDate ?? undefined,
    assignedStaff: r.assignedStaff ?? undefined,
  }));
  res.json(ListEnquiriesResponse.parse(normalized));
});

router.post("/enquiries", async (req, res): Promise<void> => {
  const parsed = CreateEnquiryBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const [enquiry] = await db.insert(enquiriesTable).values(parsed.data).returning();

  const [customer] = await db
    .select()
    .from(customersTable)
    .where(eq(customersTable.id, enquiry.customerId));

  notifyAdmins(
    `New enquiry — ${customer?.name || "Unknown customer"}`,
    enquiry.title || null,
    `/enquiries/${enquiry.id}`
  );

  res.status(201).json(
    GetEnquiryResponse.parse({ ...enquiry, customerName: customer?.name ?? undefined }),
  );
});

router.get("/enquiries/:id", async (req, res): Promise<void> => {
  const params = GetEnquiryParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const [row] = await db
    .select({
      id: enquiriesTable.id,
      customerId: enquiriesTable.customerId,
      customerName: customersTable.name,
      title: enquiriesTable.title,
      description: enquiriesTable.description,
      tankSize: enquiriesTable.tankSize,
      tankQuantity: enquiriesTable.tankQuantity,
      status: enquiriesTable.status,
      priority: enquiriesTable.priority,
      notes: enquiriesTable.notes,
      nextAction: enquiriesTable.nextAction,
      nextActionDate: enquiriesTable.nextActionDate,
      followUpDueDate: enquiriesTable.followUpDueDate,
      assignedStaff: enquiriesTable.assignedStaff,
      createdAt: enquiriesTable.createdAt,
      updatedAt: enquiriesTable.updatedAt,
    })
    .from(enquiriesTable)
    .leftJoin(customersTable, eq(enquiriesTable.customerId, customersTable.id))
    .where(eq(enquiriesTable.id, params.data.id));

  if (!row) {
    res.status(404).json({ error: "Enquiry not found" });
    return;
  }

  const [linkedInspection, linkedJob, linkedQuote] = await Promise.all([
    db.select({ id: inspectionsTable.id })
      .from(inspectionsTable)
      .where(eq(inspectionsTable.enquiryId, params.data.id))
      .limit(1),
    db.select({ id: jobsTable.id })
      .from(jobsTable)
      .where(eq(jobsTable.enquiryId, params.data.id))
      .limit(1),
    db.select({ id: quotesTable.id, quoteToken: quotesTable.quoteToken, status: quotesTable.status, paymentProofUrl: quotesTable.paymentProofUrl })
      .from(quotesTable)
      .where(eq(quotesTable.enquiryId, params.data.id))
      .orderBy(quotesTable.createdAt)
      .limit(1),
  ]);

  res.json(GetEnquiryResponse.parse({
    ...row,
    customerName: row.customerName ?? undefined,
    description: row.description ?? undefined,
    tankSize: row.tankSize ?? undefined,
    tankQuantity: row.tankQuantity ?? undefined,
    notes: row.notes ?? undefined,
    nextAction: row.nextAction ?? undefined,
    nextActionDate: row.nextActionDate ?? undefined,
    followUpDueDate: row.followUpDueDate ?? undefined,
    assignedStaff: row.assignedStaff ?? undefined,
    inspectionId: linkedInspection[0]?.id ?? undefined,
    jobId: linkedJob[0]?.id ?? undefined,
    quoteId: linkedQuote[0]?.id ?? undefined,
    quoteToken: linkedQuote[0]?.quoteToken ?? undefined,
    quoteStatus: linkedQuote[0]?.status ?? undefined,
    quotePaymentProofUrl: linkedQuote[0]?.paymentProofUrl ?? undefined,
  }));
});

router.put("/enquiries/:id", async (req, res): Promise<void> => {
  const params = UpdateEnquiryParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const parsed = UpdateEnquiryBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const [enquiry] = await db
    .update(enquiriesTable)
    .set({ ...parsed.data, updatedAt: new Date() })
    .where(eq(enquiriesTable.id, params.data.id))
    .returning();

  if (!enquiry) {
    res.status(404).json({ error: "Enquiry not found" });
    return;
  }

  const [customer] = await db
    .select()
    .from(customersTable)
    .where(eq(customersTable.id, enquiry.customerId));

  res.json(
    UpdateEnquiryResponse.parse({
      ...enquiry,
      customerName: customer?.name ?? undefined,
      nextAction: enquiry.nextAction ?? undefined,
      nextActionDate: enquiry.nextActionDate ?? undefined,
      followUpDueDate: enquiry.followUpDueDate ?? undefined,
      assignedStaff: enquiry.assignedStaff ?? undefined,
    }),
  );
});

export default router;
