import { Router, type IRouter } from "express";
import { eq, asc } from "drizzle-orm";
import { db, jobLoadsTable, jobsTable, customersTable } from "@workspace/db";
import { requireAuth } from "../middlewares/requireAuth";
import { sendJobStageEmail } from "../lib/email";
import { z } from "zod/v4";

const router: IRouter = Router();

const LoadBody = z.object({
  loadNumber: z.number().int().min(1).max(10),
  status: z.enum(["pending", "scheduled", "in_transit", "delivered"]).optional().default("pending"),
  scheduledDate: z.string().optional().nullable(),
  deliveredAt: z.string().optional().nullable(),
  tankSize: z.string().optional().nullable(),
  tankQuantity: z.number().int().optional().nullable(),
  driverName: z.string().optional().nullable(),
  vehicleReg: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
});

const UpdateLoadBody = LoadBody.partial().omit({ loadNumber: true });

function normalize(r: any) {
  return {
    ...r,
    tankSize: r.tankSize ?? undefined,
    tankQuantity: r.tankQuantity ?? undefined,
    driverName: r.driverName ?? undefined,
    vehicleReg: r.vehicleReg ?? undefined,
    notes: r.notes ?? undefined,
    scheduledDate: r.scheduledDate ?? undefined,
    deliveredAt: r.deliveredAt ?? undefined,
  };
}

router.get("/jobs/:jobId/loads", requireAuth, async (req, res): Promise<void> => {
  const jobId = Number(req.params.jobId);
  if (!jobId) { res.status(400).json({ error: "Invalid job ID" }); return; }

  const loads = await db
    .select()
    .from(jobLoadsTable)
    .where(eq(jobLoadsTable.jobId, jobId))
    .orderBy(asc(jobLoadsTable.loadNumber));

  res.json(loads.map(normalize));
});

router.post("/jobs/:jobId/loads", requireAuth, async (req, res): Promise<void> => {
  const role = (req as any).userRole;
  if (role === "guest") { res.status(403).json({ error: "Forbidden" }); return; }

  const jobId = Number(req.params.jobId);
  if (!jobId) { res.status(400).json({ error: "Invalid job ID" }); return; }

  const parsed = LoadBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }

  const [existing] = await db.select({ id: jobsTable.id }).from(jobsTable).where(eq(jobsTable.id, jobId));
  if (!existing) { res.status(404).json({ error: "Job not found" }); return; }

  const [load] = await db.insert(jobLoadsTable).values({
    jobId,
    ...parsed.data,
    scheduledDate: parsed.data.scheduledDate ? new Date(parsed.data.scheduledDate) : undefined,
    deliveredAt: parsed.data.deliveredAt ? new Date(parsed.data.deliveredAt) : undefined,
  }).returning();

  res.status(201).json(normalize(load));
});

router.put("/jobs/:jobId/loads/:id", requireAuth, async (req, res): Promise<void> => {
  const role = (req as any).userRole;
  if (role === "guest") { res.status(403).json({ error: "Forbidden" }); return; }

  const jobId = Number(req.params.jobId);
  const id = Number(req.params.id);
  if (!jobId || !id) { res.status(400).json({ error: "Invalid ID" }); return; }

  const parsed = UpdateLoadBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }

  const updateData: any = { ...parsed.data, updatedAt: new Date() };
  if (parsed.data.scheduledDate !== undefined) {
    updateData.scheduledDate = parsed.data.scheduledDate ? new Date(parsed.data.scheduledDate) : null;
  }
  if (parsed.data.deliveredAt !== undefined) {
    updateData.deliveredAt = parsed.data.deliveredAt ? new Date(parsed.data.deliveredAt) : null;
  }

  const [load] = await db.update(jobLoadsTable)
    .set(updateData)
    .where(eq(jobLoadsTable.id, id))
    .returning();

  if (!load) { res.status(404).json({ error: "Load not found" }); return; }

  // If all loads are delivered, optionally fire a notification
  if (parsed.data.status === "delivered") {
    const allLoads = await db.select().from(jobLoadsTable).where(eq(jobLoadsTable.jobId, jobId));
    const allDelivered = allLoads.every(l => l.status === "delivered");
    if (allDelivered) {
      const [[job], [customer]] = await Promise.all([
        db.select().from(jobsTable).where(eq(jobsTable.id, jobId)),
        db.select().from(customersTable).where(
          eq(customersTable.id, (await db.select({ customerId: jobsTable.customerId }).from(jobsTable).where(eq(jobsTable.id, jobId)))[0]?.customerId)
        ),
      ]);
      if (job && customer?.email && job.notificationsEnabled) {
        sendJobStageEmail({
          customerName: customer.contactName || customer.name,
          customerEmail: customer.email,
          jobTitle: job.title,
          stage: "delivered",
          customerToken: job.customerToken ?? null,
        });
      }
    }
  }

  res.json(normalize(load));
});

router.delete("/jobs/:jobId/loads/:id", requireAuth, async (req, res): Promise<void> => {
  const role = (req as any).userRole;
  if (role !== "admin") { res.status(403).json({ error: "Admin only" }); return; }

  const id = Number(req.params.id);
  if (!id) { res.status(400).json({ error: "Invalid ID" }); return; }

  await db.delete(jobLoadsTable).where(eq(jobLoadsTable.id, id));
  res.sendStatus(204);
});

export default router;
