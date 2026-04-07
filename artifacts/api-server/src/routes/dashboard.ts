import { Router, type IRouter } from "express";
import { desc, inArray, eq } from "drizzle-orm";
import { db, customersTable, enquiriesTable, jobsTable, inspectionsTable } from "@workspace/db";

const router: IRouter = Router();

router.get("/dashboard/summary", async (req, res): Promise<void> => {
  const [customers, enquiries, jobs, recentEnquiriesRaw, recentJobsRaw] = await Promise.all([
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
    jobsByStage,
    recentEnquiries,
    recentJobs,
  });
});

export default router;
