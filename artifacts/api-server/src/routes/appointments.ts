import { Router, type IRouter } from "express";
import { eq, and, ne, gte, lte, sql } from "drizzle-orm";
import { db, appointmentsTable, jobsTable, customersTable } from "@workspace/db";
import { z } from "zod";

const router: IRouter = Router();

const CreateAppointmentBody = z.object({
  jobId: z.number().int().positive(),
  type: z.enum(["inspection", "delivery", "installation"]).default("inspection"),
  title: z.string().min(1),
  scheduledAt: z.string().datetime({ offset: true }),
  durationMinutes: z.number().int().min(15).max(720).default(120),
  travelBufferMinutes: z.number().int().min(0).max(180).default(30),
  assignedToId: z.string().optional(),
  assignedToName: z.string().optional(),
  notes: z.string().optional(),
  status: z.enum(["scheduled", "completed", "cancelled"]).default("scheduled"),
});

const UpdateAppointmentBody = CreateAppointmentBody.partial().omit({ jobId: true });

// Check for crew double-booking (including travel buffers)
async function checkConflict(
  assignedToId: string,
  scheduledAt: Date,
  durationMinutes: number,
  travelBufferMinutes: number,
  excludeId?: number
): Promise<{ conflict: boolean; conflicting?: any }> {
  const bufferMs = travelBufferMinutes * 60 * 1000;
  const durationMs = durationMinutes * 60 * 1000;
  const windowStart = new Date(scheduledAt.getTime() - bufferMs);
  const windowEnd = new Date(scheduledAt.getTime() + durationMs + bufferMs);

  const conditions = [
    eq(appointmentsTable.assignedToId, assignedToId),
    ne(appointmentsTable.status, "cancelled"),
  ];
  if (excludeId) conditions.push(ne(appointmentsTable.id, excludeId));

  const existing = await db.select().from(appointmentsTable).where(and(...conditions));

  for (const apt of existing) {
    const aptBuf = apt.travelBufferMinutes * 60 * 1000;
    const aptDur = apt.durationMinutes * 60 * 1000;
    const aptStart = new Date(apt.scheduledAt.getTime() - aptBuf);
    const aptEnd = new Date(apt.scheduledAt.getTime() + aptDur + aptBuf);
    if (windowStart < aptEnd && windowEnd > aptStart) {
      return { conflict: true, conflicting: apt };
    }
  }
  return { conflict: false };
}

// GET /appointments — list with optional date range and assignedTo filters
router.get("/appointments", async (req, res): Promise<void> => {
  try {
    const { from, to, assignedToId, jobId } = req.query as Record<string, string>;

    const conditions: any[] = [];
    if (from) conditions.push(gte(appointmentsTable.scheduledAt, new Date(from)));
    if (to) conditions.push(lte(appointmentsTable.scheduledAt, new Date(to)));
    if (assignedToId) conditions.push(eq(appointmentsTable.assignedToId, assignedToId));
    if (jobId) conditions.push(eq(appointmentsTable.jobId, parseInt(jobId)));

    const rows = await db
      .select({
        id: appointmentsTable.id,
        jobId: appointmentsTable.jobId,
        jobTitle: jobsTable.title,
        customerName: customersTable.name,
        type: appointmentsTable.type,
        title: appointmentsTable.title,
        scheduledAt: appointmentsTable.scheduledAt,
        durationMinutes: appointmentsTable.durationMinutes,
        travelBufferMinutes: appointmentsTable.travelBufferMinutes,
        assignedToId: appointmentsTable.assignedToId,
        assignedToName: appointmentsTable.assignedToName,
        notes: appointmentsTable.notes,
        status: appointmentsTable.status,
        createdAt: appointmentsTable.createdAt,
        updatedAt: appointmentsTable.updatedAt,
      })
      .from(appointmentsTable)
      .leftJoin(jobsTable, eq(appointmentsTable.jobId, jobsTable.id))
      .leftJoin(customersTable, eq(jobsTable.customerId, customersTable.id))
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(appointmentsTable.scheduledAt);

    res.json(rows);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// GET /appointments/:id
router.get("/appointments/:id", async (req, res): Promise<void> => {
  const id = parseInt(req.params.id);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid ID" }); return; }

  try {
    const rows = await db
      .select({
        id: appointmentsTable.id,
        jobId: appointmentsTable.jobId,
        jobTitle: jobsTable.title,
        customerName: customersTable.name,
        type: appointmentsTable.type,
        title: appointmentsTable.title,
        scheduledAt: appointmentsTable.scheduledAt,
        durationMinutes: appointmentsTable.durationMinutes,
        travelBufferMinutes: appointmentsTable.travelBufferMinutes,
        assignedToId: appointmentsTable.assignedToId,
        assignedToName: appointmentsTable.assignedToName,
        notes: appointmentsTable.notes,
        status: appointmentsTable.status,
        createdAt: appointmentsTable.createdAt,
        updatedAt: appointmentsTable.updatedAt,
      })
      .from(appointmentsTable)
      .leftJoin(jobsTable, eq(appointmentsTable.jobId, jobsTable.id))
      .leftJoin(customersTable, eq(jobsTable.customerId, customersTable.id))
      .where(eq(appointmentsTable.id, id));

    if (!rows.length) { res.status(404).json({ error: "Appointment not found" }); return; }
    res.json(rows[0]);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// POST /appointments
router.post("/appointments", async (req, res): Promise<void> => {
  const parsed = CreateAppointmentBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Validation failed", details: parsed.error.issues });
    return;
  }

  const data = parsed.data;
  const scheduledAt = new Date(data.scheduledAt);

  try {
    // Double-booking check
    if (data.assignedToId) {
      const { conflict, conflicting } = await checkConflict(
        data.assignedToId,
        scheduledAt,
        data.durationMinutes,
        data.travelBufferMinutes
      );
      if (conflict) {
        res.status(409).json({
          error: "Crew member is already booked during this time window (including travel buffer)",
          conflicting,
        });
        return;
      }
    }

    const [row] = await db
      .insert(appointmentsTable)
      .values({ ...data, scheduledAt })
      .returning();

    res.status(201).json(row);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// PUT /appointments/:id
router.put("/appointments/:id", async (req, res): Promise<void> => {
  const id = parseInt(req.params.id);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid ID" }); return; }

  const parsed = UpdateAppointmentBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Validation failed", details: parsed.error.issues });
    return;
  }

  const data = parsed.data;

  try {
    const [existing] = await db.select().from(appointmentsTable).where(eq(appointmentsTable.id, id));
    if (!existing) { res.status(404).json({ error: "Appointment not found" }); return; }

    const scheduledAt = data.scheduledAt ? new Date(data.scheduledAt) : existing.scheduledAt;
    const durationMinutes = data.durationMinutes ?? existing.durationMinutes;
    const travelBufferMinutes = data.travelBufferMinutes ?? existing.travelBufferMinutes;
    const assignedToId = data.assignedToId ?? existing.assignedToId;

    // Double-booking check (exclude self)
    if (assignedToId) {
      const { conflict, conflicting } = await checkConflict(
        assignedToId,
        scheduledAt,
        durationMinutes,
        travelBufferMinutes,
        id
      );
      if (conflict) {
        res.status(409).json({
          error: "Crew member is already booked during this time window (including travel buffer)",
          conflicting,
        });
        return;
      }
    }

    const updates: Record<string, any> = { ...data, updatedAt: new Date() };
    if (data.scheduledAt) updates.scheduledAt = scheduledAt;

    const [row] = await db
      .update(appointmentsTable)
      .set(updates)
      .where(eq(appointmentsTable.id, id))
      .returning();

    res.json(row);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /appointments/:id
router.delete("/appointments/:id", async (req, res): Promise<void> => {
  const id = parseInt(req.params.id);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid ID" }); return; }

  try {
    const [row] = await db
      .delete(appointmentsTable)
      .where(eq(appointmentsTable.id, id))
      .returning();

    if (!row) { res.status(404).json({ error: "Appointment not found" }); return; }
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
