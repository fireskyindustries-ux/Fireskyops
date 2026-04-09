import { Router, type IRouter } from "express";
import { desc, inArray, eq, and, lt, notInArray, count, gt } from "drizzle-orm";
import { db, customersTable, enquiriesTable, jobsTable, inspectionsTable } from "@workspace/db";
import { loadSchedulerState, STALE_MS } from "../lib/scheduler-state";

const router: IRouter = Router();

router.get("/dashboard/summary", async (req, res): Promise<void> => {
  const schedulerState = loadSchedulerState();
  const since = new Date(schedulerState.lastSuccessfulCheck);
  const staleThreshold = new Date(Date.now() - STALE_MS);

  const [customers, enquiries, jobs, recentEnquiriesRaw, recentJobsRaw,
         staleEnquiries, staleJobs, urgentEnquiries, urgentJobs,
         newCustomers, newEnquiries, newJobs, newInspections] = await Promise.all([
    db.select().from(customersTable),
    db.select().from(enquiriesTable),
    db.select().from(jobsTable),
    db
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
      .orderBy(desc(enquiriesTable.createdAt))
      .limit(5),
    db
      .select()
      .from(jobsTable)
      .orderBy(desc(jobsTable.createdAt))
      .limit(5),
    db.select({ count: count() }).from(enquiriesTable).where(
      and(inArray(enquiriesTable.status, ["new", "in_progress"]), lt(enquiriesTable.updatedAt, staleThreshold)),
    ),
    db.select({ count: count() }).from(jobsTable).where(
      and(notInArray(jobsTable.stage, ["won", "lost", "closed"]), lt(jobsTable.updatedAt, staleThreshold)),
    ),
    db.select({ count: count() }).from(enquiriesTable).where(eq(enquiriesTable.priority, "high")),
    db.select({ count: count() }).from(jobsTable).where(eq(jobsTable.priority, "high")),
    // New records since last scheduler check
    db.select({ count: count() }).from(customersTable).where(gt(customersTable.createdAt, since)),
    db.select({ count: count() }).from(enquiriesTable).where(gt(enquiriesTable.createdAt, since)),
    db.select({ count: count() }).from(jobsTable).where(gt(jobsTable.createdAt, since)),
    db.select({ count: count() }).from(inspectionsTable).where(gt(inspectionsTable.createdAt, since)),
  ]);

  const enquiryIds = recentEnquiriesRaw.map((e) => e.id);
  const [linkedInspections, linkedJobs] = enquiryIds.length > 0
    ? await Promise.all([
        db.select({ id: inspectionsTable.id, enquiryId: inspectionsTable.enquiryId })
          .from(inspectionsTable)
          .where(inArray(inspectionsTable.enquiryId, enquiryIds)),
        db.select({ id: jobsTable.id, enquiryId: jobsTable.enquiryId })
          .from(jobsTable)
          .where(inArray(jobsTable.enquiryId, enquiryIds)),
      ])
    : [[], []];

  const inspectionByEnquiry: Record<number, number> = {};
  for (const i of linkedInspections) {
    if (i.enquiryId != null) inspectionByEnquiry[i.enquiryId] = i.id;
  }
  const jobByEnquiry: Record<number, number> = {};
  for (const j of linkedJobs) {
    if (j.enquiryId != null) jobByEnquiry[j.enquiryId] = j.id;
  }

  const jobsByStage: Record<string, number> = {};
  for (const job of jobs) {
    jobsByStage[job.stage] = (jobsByStage[job.stage] ?? 0) + 1;
  }

  const recentEnquiries = recentEnquiriesRaw.map((e) => ({
    ...e,
    customerName: e.customerName ?? undefined,
    inspectionId: inspectionByEnquiry[e.id] ?? undefined,
    jobId: jobByEnquiry[e.id] ?? undefined,
  }));

  const recentJobs = recentJobsRaw.map((j) => ({
    ...j,
    customerName: undefined,
    inspectionId: j.inspectionId ?? undefined,
    enquiryId: j.enquiryId ?? undefined,
  }));

  res.json({
    totalCustomers: customers.length,
    totalEnquiries: enquiries.length,
    totalJobs: jobs.length,
    staleEnquiries: Number(staleEnquiries[0].count),
    staleJobs: Number(staleJobs[0].count),
    urgentEnquiries: Number(urgentEnquiries[0].count),
    urgentJobs: Number(urgentJobs[0].count),
    newRecords: Number(newCustomers[0].count) + Number(newEnquiries[0].count) + Number(newJobs[0].count) + Number(newInspections[0].count),
    lastChecked: schedulerState.lastSuccessfulCheck,
    jobsByStage,
    recentEnquiries,
    recentJobs,
  });
});

export default router;
