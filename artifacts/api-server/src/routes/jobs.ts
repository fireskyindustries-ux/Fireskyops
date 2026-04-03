import { Router, type IRouter } from "express";
import { eq } from "drizzle-orm";
import { db, jobsTable, customersTable } from "@workspace/db";
import {
  ListJobsQueryParams,
  ListJobsResponse,
  CreateJobBody,
  GetJobParams,
  GetJobResponse,
  UpdateJobParams,
  UpdateJobBody,
  UpdateJobResponse,
  DeleteJobParams,
} from "@workspace/api-zod";

const router: IRouter = Router();

router.get("/jobs", async (req, res): Promise<void> => {
  const query = ListJobsQueryParams.safeParse(req.query);
  if (!query.success) {
    res.status(400).json({ error: query.error.message });
    return;
  }

  let rows = await db
    .select({
      id: jobsTable.id,
      customerId: jobsTable.customerId,
      customerName: customersTable.name,
      enquiryId: jobsTable.enquiryId,
      inspectionId: jobsTable.inspectionId,
      title: jobsTable.title,
      stage: jobsTable.stage,
      priority: jobsTable.priority,
      tankSize: jobsTable.tankSize,
      tankQuantity: jobsTable.tankQuantity,
      estimatedValue: jobsTable.estimatedValue,
      notes: jobsTable.notes,
      createdAt: jobsTable.createdAt,
      updatedAt: jobsTable.updatedAt,
    })
    .from(jobsTable)
    .leftJoin(customersTable, eq(jobsTable.customerId, customersTable.id))
    .orderBy(jobsTable.createdAt);

  if (query.data.stage) {
    rows = rows.filter((r) => r.stage === query.data.stage);
  }
  if (query.data.customerId) {
    rows = rows.filter((r) => r.customerId === query.data.customerId);
  }

  const normalized = rows.map((r) => ({
    ...r,
    customerName: r.customerName ?? undefined,
    enquiryId: r.enquiryId ?? undefined,
    inspectionId: r.inspectionId ?? undefined,
    tankSize: r.tankSize ?? undefined,
    tankQuantity: r.tankQuantity ?? undefined,
    estimatedValue: r.estimatedValue ?? undefined,
    notes: r.notes ?? undefined,
  }));
  res.json(ListJobsResponse.parse(normalized));
});

router.post("/jobs", async (req, res): Promise<void> => {
  const parsed = CreateJobBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const [job] = await db.insert(jobsTable).values(parsed.data).returning();

  const [customer] = await db
    .select()
    .from(customersTable)
    .where(eq(customersTable.id, job.customerId));

  res.status(201).json(
    GetJobResponse.parse({
      ...job,
      customerName: customer?.name ?? undefined,
      enquiryId: job.enquiryId ?? undefined,
      inspectionId: job.inspectionId ?? undefined,
    }),
  );
});

router.get("/jobs/:id", async (req, res): Promise<void> => {
  const params = GetJobParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const [row] = await db
    .select({
      id: jobsTable.id,
      customerId: jobsTable.customerId,
      customerName: customersTable.name,
      enquiryId: jobsTable.enquiryId,
      inspectionId: jobsTable.inspectionId,
      title: jobsTable.title,
      stage: jobsTable.stage,
      priority: jobsTable.priority,
      tankSize: jobsTable.tankSize,
      tankQuantity: jobsTable.tankQuantity,
      estimatedValue: jobsTable.estimatedValue,
      notes: jobsTable.notes,
      createdAt: jobsTable.createdAt,
      updatedAt: jobsTable.updatedAt,
    })
    .from(jobsTable)
    .leftJoin(customersTable, eq(jobsTable.customerId, customersTable.id))
    .where(eq(jobsTable.id, params.data.id));

  if (!row) {
    res.status(404).json({ error: "Job not found" });
    return;
  }

  res.json(GetJobResponse.parse({
    ...row,
    customerName: row.customerName ?? undefined,
    enquiryId: row.enquiryId ?? undefined,
    inspectionId: row.inspectionId ?? undefined,
    tankSize: row.tankSize ?? undefined,
    tankQuantity: row.tankQuantity ?? undefined,
    estimatedValue: row.estimatedValue ?? undefined,
    notes: row.notes ?? undefined,
  }));
});

router.put("/jobs/:id", async (req, res): Promise<void> => {
  const params = UpdateJobParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const parsed = UpdateJobBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const [job] = await db
    .update(jobsTable)
    .set({ ...parsed.data, updatedAt: new Date() })
    .where(eq(jobsTable.id, params.data.id))
    .returning();

  if (!job) {
    res.status(404).json({ error: "Job not found" });
    return;
  }

  const [customer] = await db
    .select()
    .from(customersTable)
    .where(eq(customersTable.id, job.customerId));

  res.json(
    UpdateJobResponse.parse({
      ...job,
      customerName: customer?.name ?? undefined,
      enquiryId: job.enquiryId ?? undefined,
      inspectionId: job.inspectionId ?? undefined,
    }),
  );
});

router.delete("/jobs/:id", async (req, res): Promise<void> => {
  const params = DeleteJobParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const [job] = await db
    .delete(jobsTable)
    .where(eq(jobsTable.id, params.data.id))
    .returning();

  if (!job) {
    res.status(404).json({ error: "Job not found" });
    return;
  }

  res.sendStatus(204);
});

export default router;
