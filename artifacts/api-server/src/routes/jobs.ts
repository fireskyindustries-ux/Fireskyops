import { Router, type IRouter } from "express";
import { eq } from "drizzle-orm";
import { db, jobsTable, customersTable } from "@workspace/db";
import { isAdmin as checkAdmin, getBranchId } from "../middlewares/requireAuth";
import {
  ListJobsQueryParams,
  CreateJobBody,
  GetJobParams,
  UpdateJobParams,
  UpdateJobBody,
  DeleteJobParams,
} from "@workspace/api-zod";
import { requireAuth } from "../middlewares/requireAuth";
import { sendJobStageEmail } from "../lib/email";
import { notifyUsers, notifyAdmins } from "../lib/notify";

const router: IRouter = Router();

const SELECT_FIELDS = {
  id: jobsTable.id,
  customerId: jobsTable.customerId,
  customerName: customersTable.name,
  customerEmail: customersTable.email,
  customerPhone: customersTable.phone,
  enquiryId: jobsTable.enquiryId,
  inspectionId: jobsTable.inspectionId,
  title: jobsTable.title,
  stage: jobsTable.stage,
  priority: jobsTable.priority,
  tankSize: jobsTable.tankSize,
  tankQuantity: jobsTable.tankQuantity,
  estimatedValue: jobsTable.estimatedValue,
  assignedToId: jobsTable.assignedToId,
  jobType: jobsTable.jobType,
  notes: jobsTable.notes,
  nextAction: jobsTable.nextAction,
  nextActionDate: jobsTable.nextActionDate,
  followUpDueDate: jobsTable.followUpDueDate,
  quoteSentDate: jobsTable.quoteSentDate,
  lostReason: jobsTable.lostReason,
  accessRisk: jobsTable.accessRisk,
  signatureUrl: jobsTable.signatureUrl,
  signedOffBy: jobsTable.signedOffBy,
  signedOffAt: jobsTable.signedOffAt,
  customerToken: jobsTable.customerToken,
  notificationsEnabled: jobsTable.notificationsEnabled,
  createdAt: jobsTable.createdAt,
  updatedAt: jobsTable.updatedAt,
};

function normalize(r: any) {
  return {
    ...r,
    customerName: r.customerName ?? undefined,
    customerEmail: r.customerEmail ?? undefined,
    customerPhone: r.customerPhone ?? undefined,
    enquiryId: r.enquiryId ?? undefined,
    inspectionId: r.inspectionId ?? undefined,
    tankSize: r.tankSize ?? undefined,
    tankQuantity: r.tankQuantity ?? undefined,
    estimatedValue: r.estimatedValue ?? undefined,
    assignedToId: r.assignedToId ?? undefined,
    notes: r.notes ?? undefined,
    nextAction: r.nextAction ?? undefined,
    nextActionDate: r.nextActionDate ?? undefined,
    followUpDueDate: r.followUpDueDate ?? undefined,
    quoteSentDate: r.quoteSentDate ?? undefined,
    lostReason: r.lostReason ?? undefined,
    accessRisk: r.accessRisk ?? undefined,
    signatureUrl: r.signatureUrl ?? undefined,
    signedOffBy: r.signedOffBy ?? undefined,
    signedOffAt: r.signedOffAt ?? undefined,
    customerToken: r.customerToken ?? undefined,
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
  const branchId = checkAdmin(req) ? null : getBranchId(req);

  let rows = await db
    .select(SELECT_FIELDS)
    .from(jobsTable)
    .leftJoin(customersTable, eq(jobsTable.customerId, customersTable.id))
    .where(branchId ? eq(jobsTable.branchId, branchId) : undefined)
    .orderBy(jobsTable.createdAt);

  if (role === "user" || role === "field_worker") {
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

  const branchId = getBranchId(req) ?? undefined;
  const [job] = await db.insert(jobsTable).values({ ...parsed.data, branchId }).returning();

  const [customer] = await db
    .select()
    .from(customersTable)
    .where(eq(customersTable.id, job.customerId));

  // Send initial enquiry email if customer has an email
  if (customer?.email && job.notificationsEnabled) {
    sendJobStageEmail({
      customerName: customer.contactName || customer.name,
      customerEmail: customer.email,
      jobTitle: job.title,
      stage: job.stage,
      customerToken: job.customerToken ?? null,
    });
  }

  res.status(201).json(normalize({ ...job, customerName: customer?.name, customerEmail: customer?.email, customerPhone: customer?.phone }));
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

  // Fetch the current job to detect stage changes
  const [existing] = await db
    .select({ stage: jobsTable.stage, notificationsEnabled: jobsTable.notificationsEnabled, customerToken: jobsTable.customerToken })
    .from(jobsTable)
    .where(eq(jobsTable.id, params.data.id));

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

  // Fire email if stage changed and notifications are on
  const stageChanged = existing && parsed.data.stage && existing.stage !== parsed.data.stage;
  if (stageChanged && job.notificationsEnabled && customer?.email) {
    sendJobStageEmail({
      customerName: customer.contactName || customer.name,
      customerEmail: customer.email,
      jobTitle: job.title,
      stage: job.stage,
      customerToken: job.customerToken ?? null,
    });
  }

  // In-app notifications on stage change
  if (stageChanged) {
    const STAGE_LABELS: Record<string, string> = {
      enquiry: "Enquiry", inspection: "Inspection", quoting: "Quoting",
      quoted: "Quoted", won: "Won", lost: "Lost", closed: "Closed",
    };
    const prevLabel = STAGE_LABELS[existing.stage] ?? existing.stage;
    const newLabel = STAGE_LABELS[job.stage] ?? job.stage;

    // Notify admins of the stage change
    notifyAdmins(
      `Job stage changed — ${job.title}`,
      `${prevLabel} → ${newLabel}`,
      `/jobs/${job.id}`
    );

    // Also notify assignee if they are not an admin (they get it separately)
    if (job.assignedToId) {
      notifyUsers(
        [job.assignedToId],
        `Job stage updated — ${job.title}`,
        `Moved to ${newLabel}`,
        `/jobs/${job.id}`
      );
    }
  }

  res.json(normalize({ ...job, customerName: customer?.name, customerEmail: customer?.email, customerPhone: customer?.phone }));
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

  // Notify the newly assigned user
  if (assignedToId) {
    notifyUsers(
      [assignedToId],
      `You've been assigned to a job`,
      job.title,
      `/jobs/${job.id}`
    );
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
