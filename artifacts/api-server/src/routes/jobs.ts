import { Router, type IRouter } from "express";
import { eq } from "drizzle-orm";
import { db, jobsTable, customersTable } from "@workspace/db";
import {
  ListJobsQueryParams,
  CreateJobBody,
  GetJobParams,
  UpdateJobParams,
  UpdateJobBody,
  DeleteJobParams,
} from "@workspace/api-zod";
import { requireAuth } from "../middlewares/requireAuth";

const router: IRouter = Router();

const SELECT_FIELDS = {
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
  assignedToId: jobsTable.assignedToId,
  notes: jobsTable.notes,
  createdAt: jobsTable.createdAt,
  updatedAt: jobsTable.updatedAt,
};

function normalize(r: any) {
  return {
    ...r,
    customerName: r.customerName ?? undefined,
    enquiryId: r.enquiryId ?? undefined,
    inspectionId: r.inspectionId ?? undefined,
    tankSize: r.tankSize ?? undefined,
    tankQuantity: r.tankQuantity ?? undefined,
    estimatedValue: r.estimatedValue ?? undefined,
    assignedToId: r.assignedToId ?? undefined,
    notes: r.notes ?? undefined,
  };
}

router.get("/jobs", requireAuth, async (req, res): Promise<void> => {
  const query = ListJobsQueryParams.safeParse(req.query);
  if (!query.success) {
    res.status(400).json({ error: query.error.message });
    return;
  }

  const role = (req as any).userRole;
  const userId = (req as any).userId;

  let rows = await db
    .select(SELECT_FIELDS)
    .from(jobsTable)
    .leftJoin(customersTable, eq(jobsTable.customerId, customersTable.id))
    .orderBy(jobsTable.createdAt);

  if (role === "user") {
    rows = rows.filter((r) => r.assignedToId === userId);
  }
  if (query.data.stage) {
    rows = rows.filter((r) => r.stage === query.data.stage);
  }
  if (query.data.customerId) {
    rows = rows.filter((r) => r.customerId === query.data.customerId);
  }

  res.json(rows.map(normalize));
});

router.post("/jobs", requireAuth, async (req, res): Promise<void> => {
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

  res.status(201).json(normalize({ ...job, customerName: customer?.name }));
});

router.get("/jobs/:id", requireAuth, async (req, res): Promise<void> => {
  const params = GetJobParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const role = (req as any).userRole;
  const userId = (req as any).userId;

  const [row] = await db
    .select(SELECT_FIELDS)
    .from(jobsTable)
    .leftJoin(customersTable, eq(jobsTable.customerId, customersTable.id))
    .where(eq(jobsTable.id, params.data.id));

  if (!row) {
    res.status(404).json({ error: "Job not found" });
    return;
  }

  if (role === "user" && row.assignedToId !== userId) {
    res.status(403).json({ error: "Not assigned to you" });
    return;
  }

  res.json(normalize(row));
});

router.put("/jobs/:id", requireAuth, async (req, res): Promise<void> => {
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

  res.json(normalize({ ...job, customerName: customer?.name }));
});

router.patch("/jobs/:id/assign", requireAuth, async (req, res): Promise<void> => {
  const role = (req as any).userRole;
  if (role !== "admin") {
    res.status(403).json({ error: "Admin only" });
    return;
  }

  const id = Number(req.params.id);
  if (!id) {
    res.status(400).json({ error: "Invalid id" });
    return;
  }

  const { assignedToId } = req.body;

  const [job] = await db
    .update(jobsTable)
    .set({ assignedToId: assignedToId ?? null, updatedAt: new Date() })
    .where(eq(jobsTable.id, id))
    .returning();

  if (!job) {
    res.status(404).json({ error: "Job not found" });
    return;
  }

  res.json({ id: job.id, assignedToId: job.assignedToId });
});

router.delete("/jobs/:id", requireAuth, async (req, res): Promise<void> => {
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
