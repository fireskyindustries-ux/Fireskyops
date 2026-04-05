import { Router, type IRouter } from "express";
import { desc } from "drizzle-orm";
import { db, customersTable, enquiriesTable, jobsTable, inspectionsTable } from "@workspace/db";

const router: IRouter = Router();

router.get("/dashboard/summary", async (req, res): Promise<void> => {
  const [customers, enquiries, jobs, recentEnquiriesRaw, recentJobsRaw] = await Promise.all([
    db.select().from(customersTable),
    db.select().from(enquiriesTable),
    db.select().from(jobsTable),
    db
      .select()
      .from(enquiriesTable)
      .orderBy(desc(enquiriesTable.createdAt))
      .limit(5),
    db
      .select()
      .from(jobsTable)
      .orderBy(desc(jobsTable.createdAt))
      .limit(5),
  ]);

  const jobsByStage: Record<string, number> = {};
  for (const job of jobs) {
    jobsByStage[job.stage] = (jobsByStage[job.stage] ?? 0) + 1;
  }

  const recentEnquiries = recentEnquiriesRaw.map((e) => ({
    ...e,
    customerName: undefined,
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
