import { Router, type IRouter } from "express";
import { eq } from "drizzle-orm";
import { db, enquiriesTable, customersTable } from "@workspace/db";
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

  res.json(GetEnquiryResponse.parse({
    ...row,
    customerName: row.customerName ?? undefined,
    description: row.description ?? undefined,
    tankSize: row.tankSize ?? undefined,
    tankQuantity: row.tankQuantity ?? undefined,
    notes: row.notes ?? undefined,
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
    UpdateEnquiryResponse.parse({ ...enquiry, customerName: customer?.name ?? undefined }),
  );
});

export default router;
