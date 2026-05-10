import { Router, type IRouter } from "express";
import { desc, inArray, eq, and, lt, notInArray, count, gt, gte, lte, isNull, or, sql } from "drizzle-orm";
import { db, customersTable, enquiriesTable, jobsTable, inspectionsTable, branchesTable, stockLevelsTable, stockItemsTable, quotesTable } from "@workspace/db";
import { loadSchedulerState, STALE_MS } from "../lib/scheduler-state";
import { isAdmin, getBranchId } from "../middlewares/requireAuth";

const router: IRouter = Router();

router.get("/dashboard/summary", async (req, res): Promise<void> => {
  const schedulerState = loadSchedulerState();
  const since = new Date(schedulerState.lastSuccessfulCheck);
  const staleThreshold = new Date(Date.now() - STALE_MS);

  const today = new Date().toISOString().slice(0, 10);

  // Optional date range filtering
  const fromParam = req.query.from ? new Date(req.query.from as string) : null;
  const toParam = req.query.to ? new Date(req.query.to as string) : null;
  const dr = (col: any) => {
    if (fromParam && toParam) return and(gte(col, fromParam), lte(col, toParam));
    if (fromParam) return gte(col, fromParam);
    if (toParam) return lte(col, toParam);
    return sql`true`;
  };

  const INACTIVE: string[] = ["won", "lost", "closed"];

  const [customers, enquiries, jobs, recentEnquiriesRaw, recentJobsRaw,
         staleEnquiries, staleJobs, urgentEnquiries, urgentJobs,
         newCustomers, newEnquiries, newJobs, newInspections,
         overdueFollowUpEnquiries, overdueFollowUpJobs,
         noNextActionEnquiries, noNextActionJobs,
         quotedNoFollowUp, lostNoReason, highAccessRiskJobs,
         customerDeclinedQuotes] = await Promise.all([
    db.select().from(customersTable),
    db.select().from(enquiriesTable).where(and(notInArray(enquiriesTable.status, INACTIVE), dr(enquiriesTable.createdAt))),
    db.select().from(jobsTable).where(and(notInArray(jobsTable.stage, INACTIVE), dr(jobsTable.createdAt))),
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
      .where(and(notInArray(enquiriesTable.status, INACTIVE), dr(enquiriesTable.createdAt)))
      .orderBy(desc(enquiriesTable.createdAt))
      .limit(5),
    db
      .select()
      .from(jobsTable)
      .where(and(notInArray(jobsTable.stage, INACTIVE), dr(jobsTable.createdAt)))
      .orderBy(desc(jobsTable.createdAt))
      .limit(5),
    db.select({ count: count() }).from(enquiriesTable).where(
      and(inArray(enquiriesTable.status, ["new", "in_progress"]), lt(enquiriesTable.updatedAt, staleThreshold), dr(enquiriesTable.createdAt)),
    ),
    db.select({ count: count() }).from(jobsTable).where(
      and(notInArray(jobsTable.stage, INACTIVE), lt(jobsTable.updatedAt, staleThreshold), dr(jobsTable.createdAt)),
    ),
    db.select({ count: count() }).from(enquiriesTable).where(and(notInArray(enquiriesTable.status, INACTIVE), eq(enquiriesTable.priority, "high"), dr(enquiriesTable.createdAt))),
    db.select({ count: count() }).from(jobsTable).where(and(notInArray(jobsTable.stage, INACTIVE), eq(jobsTable.priority, "high"), dr(jobsTable.createdAt))),
    // New records since last scheduler check
    db.select({ count: count() }).from(customersTable).where(gt(customersTable.createdAt, since)),
    db.select({ count: count() }).from(enquiriesTable).where(gt(enquiriesTable.createdAt, since)),
    db.select({ count: count() }).from(jobsTable).where(gt(jobsTable.createdAt, since)),
    db.select({ count: count() }).from(inspectionsTable).where(gt(inspectionsTable.createdAt, since)),
    // Data quality — overdue follow-up
    db.select({ count: count() }).from(enquiriesTable).where(
      and(
        notInArray(enquiriesTable.status, INACTIVE),
        sql`${enquiriesTable.followUpDueDate} is not null`,
        sql`${enquiriesTable.followUpDueDate} < ${today}`,
        dr(enquiriesTable.createdAt),
      ),
    ),
    db.select({ count: count() }).from(jobsTable).where(
      and(
        notInArray(jobsTable.stage, INACTIVE),
        sql`${jobsTable.followUpDueDate} is not null`,
        sql`${jobsTable.followUpDueDate} < ${today}`,
        dr(jobsTable.createdAt),
      ),
    ),
    // Data quality — no next action (null or empty string)
    db.select({ count: count() }).from(enquiriesTable).where(
      and(
        notInArray(enquiriesTable.status, INACTIVE),
        or(isNull(enquiriesTable.nextAction), eq(enquiriesTable.nextAction, "")),
        dr(enquiriesTable.createdAt),
      ),
    ),
    db.select({ count: count() }).from(jobsTable).where(
      and(
        notInArray(jobsTable.stage, INACTIVE),
        or(isNull(jobsTable.nextAction), eq(jobsTable.nextAction, "")),
        dr(jobsTable.createdAt),
      ),
    ),
    // Data quality — quoted with no follow-up date
    db.select({ count: count() }).from(jobsTable).where(
      and(eq(jobsTable.stage, "quoted"), isNull(jobsTable.followUpDueDate), dr(jobsTable.createdAt)),
    ),
    // Data quality — lost with no reason
    db.select({ count: count() }).from(jobsTable).where(
      and(eq(jobsTable.stage, "lost"), isNull(jobsTable.lostReason), dr(jobsTable.createdAt)),
    ),
    // Data quality — high access risk
    db.select({ count: count() }).from(jobsTable).where(and(eq(jobsTable.accessRisk, "high"), dr(jobsTable.createdAt))),
    // Data quality — customer declined quote (active jobs/enquiries with a rejected quote)
    db.select({ count: count() }).from(quotesTable).where(
      and(eq(quotesTable.status, "rejected"), dr(quotesTable.updatedAt)),
    ),
  ]);

  // Branch breakdown — run in parallel with enquiry link lookups
  const [branchList, branchCustomerCounts, branchEnquiryCounts, branchJobCounts] = await Promise.all([
    db.select().from(branchesTable).orderBy(branchesTable.id),
    db.select({ branchId: customersTable.branchId, c: count() }).from(customersTable).groupBy(customersTable.branchId),
    db.select({ branchId: enquiriesTable.branchId, c: count() }).from(enquiriesTable)
      .where(notInArray(enquiriesTable.status, ["won", "lost", "closed"]))
      .groupBy(enquiriesTable.branchId),
    db.select({ branchId: jobsTable.branchId, c: count() }).from(jobsTable)
      .where(notInArray(jobsTable.stage, ["won", "lost", "closed"]))
      .groupBy(jobsTable.branchId),
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

  const custByBranch = Object.fromEntries(branchCustomerCounts.map((r) => [r.branchId ?? 0, Number(r.c)]));
  const enqByBranch = Object.fromEntries(branchEnquiryCounts.map((r) => [r.branchId ?? 0, Number(r.c)]));
  const jobsByBranch = Object.fromEntries(branchJobCounts.map((r) => [r.branchId ?? 0, Number(r.c)]));

  const branchBreakdown = branchList.map((b) => ({
    id: b.id,
    name: b.name,
    region: b.region,
    customers: custByBranch[b.id] ?? 0,
    activeEnquiries: enqByBranch[b.id] ?? 0,
    activeJobs: jobsByBranch[b.id] ?? 0,
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
    overdueFollowUpEnquiries: Number(overdueFollowUpEnquiries[0].count),
    overdueFollowUpJobs: Number(overdueFollowUpJobs[0].count),
    noNextActionEnquiries: Number(noNextActionEnquiries[0].count),
    noNextActionJobs: Number(noNextActionJobs[0].count),
    quotedNoFollowUp: Number(quotedNoFollowUp[0].count),
    lostNoReason: Number(lostNoReason[0].count),
    highAccessRiskJobs: Number(highAccessRiskJobs[0].count),
    customerDeclinedQuotes: Number(customerDeclinedQuotes[0].count),
    lastChecked: schedulerState.lastSuccessfulCheck,
    jobsByStage,
    recentEnquiries,
    recentJobs,
    branchBreakdown,
  });
});

router.get("/dashboard/branch-summary", async (req, res): Promise<void> => {
  const adminUser = isAdmin(req);
  const userBranchId = getBranchId(req);
  const branchId = adminUser
    ? Number(req.query.branchId ?? userBranchId ?? 0) || null
    : userBranchId;

  if (!branchId) {
    res.status(400).json({ error: "No branch assigned or specified" });
    return;
  }

  const schedulerState = loadSchedulerState();
  const since = new Date(schedulerState.lastSuccessfulCheck);
  const staleThreshold = new Date(Date.now() - STALE_MS);
  const today = new Date().toISOString().slice(0, 10);

  const B = (col: any) => eq(col, branchId);

  const [
    branch,
    allJobsRaw,
    customersRaw, enquiriesRaw,
    staleEnquiriesRaw, staleJobsRaw,
    urgentEnquiriesRaw, urgentJobsRaw,
    newCustomersRaw, newEnquiriesRaw, newJobsRaw, newInspectionsRaw,
    overdueFollowUpEnqRaw, overdueFollowUpJobsRaw,
    noNextActionEnqRaw, noNextActionJobsRaw,
    quotedNoFollowUpRaw, lostNoReasonRaw, highRiskJobsRaw,
    recentEnquiriesRaw, recentJobsRaw,
    stockSnapshot,
  ] = await Promise.all([
    db.select().from(branchesTable).where(eq(branchesTable.id, branchId)).limit(1),

    // All active jobs for this branch (for stage breakdown)
    db.select({ stage: jobsTable.stage }).from(jobsTable).where(and(B(jobsTable.branchId), notInArray(jobsTable.stage, ["won", "lost", "closed"]))),

    // Stat counts
    db.select({ count: count() }).from(customersTable).where(B(customersTable.branchId)),
    db.select({ count: count() }).from(enquiriesTable).where(and(B(enquiriesTable.branchId), notInArray(enquiriesTable.status, ["won", "lost", "closed"]))),

    // Stale
    db.select({ count: count() }).from(enquiriesTable).where(and(B(enquiriesTable.branchId), inArray(enquiriesTable.status, ["new", "in_progress"]), lt(enquiriesTable.updatedAt, staleThreshold))),
    db.select({ count: count() }).from(jobsTable).where(and(B(jobsTable.branchId), notInArray(jobsTable.stage, ["won", "lost", "closed"]), lt(jobsTable.updatedAt, staleThreshold))),

    // Urgent
    db.select({ count: count() }).from(enquiriesTable).where(and(B(enquiriesTable.branchId), notInArray(enquiriesTable.status, ["won", "lost", "closed"]), eq(enquiriesTable.priority, "high"))),
    db.select({ count: count() }).from(jobsTable).where(and(B(jobsTable.branchId), notInArray(jobsTable.stage, ["won", "lost", "closed"]), eq(jobsTable.priority, "high"))),

    // New since last check
    db.select({ count: count() }).from(customersTable).where(and(B(customersTable.branchId), gt(customersTable.createdAt, since))),
    db.select({ count: count() }).from(enquiriesTable).where(and(B(enquiriesTable.branchId), gt(enquiriesTable.createdAt, since))),
    db.select({ count: count() }).from(jobsTable).where(and(B(jobsTable.branchId), gt(jobsTable.createdAt, since))),
    db.select({ count: count() }).from(inspectionsTable).where(and(B(inspectionsTable.branchId), gt(inspectionsTable.createdAt, since))),

    // Data quality
    db.select({ count: count() }).from(enquiriesTable).where(and(B(enquiriesTable.branchId), notInArray(enquiriesTable.status, ["won", "lost", "closed"]), sql`${enquiriesTable.followUpDueDate} is not null`, sql`${enquiriesTable.followUpDueDate} < ${today}`)),
    db.select({ count: count() }).from(jobsTable).where(and(B(jobsTable.branchId), notInArray(jobsTable.stage, ["won", "lost", "closed"]), sql`${jobsTable.followUpDueDate} is not null`, sql`${jobsTable.followUpDueDate} < ${today}`)),
    db.select({ count: count() }).from(enquiriesTable).where(and(B(enquiriesTable.branchId), notInArray(enquiriesTable.status, ["won", "lost", "closed"]), or(isNull(enquiriesTable.nextAction), eq(enquiriesTable.nextAction, "")))),
    db.select({ count: count() }).from(jobsTable).where(and(B(jobsTable.branchId), notInArray(jobsTable.stage, ["won", "lost", "closed"]), or(isNull(jobsTable.nextAction), eq(jobsTable.nextAction, "")))),
    db.select({ count: count() }).from(jobsTable).where(and(B(jobsTable.branchId), eq(jobsTable.stage, "quoted"), isNull(jobsTable.followUpDueDate))),
    db.select({ count: count() }).from(jobsTable).where(and(B(jobsTable.branchId), eq(jobsTable.stage, "lost"), isNull(jobsTable.lostReason))),
    db.select({ count: count() }).from(jobsTable).where(and(B(jobsTable.branchId), eq(jobsTable.accessRisk, "high"))),

    // Recent active enquiries
    db.select({
      id: enquiriesTable.id,
      customerId: enquiriesTable.customerId,
      customerName: customersTable.name,
      title: enquiriesTable.title,
      status: enquiriesTable.status,
      priority: enquiriesTable.priority,
      createdAt: enquiriesTable.createdAt,
    }).from(enquiriesTable)
      .leftJoin(customersTable, eq(enquiriesTable.customerId, customersTable.id))
      .where(and(B(enquiriesTable.branchId), notInArray(enquiriesTable.status, ["won", "lost", "closed"])))
      .orderBy(desc(enquiriesTable.createdAt))
      .limit(5),

    // Recent active jobs
    db.select({
      id: jobsTable.id,
      customerId: jobsTable.customerId,
      customerName: customersTable.name,
      title: jobsTable.title,
      stage: jobsTable.stage,
      priority: jobsTable.priority,
      enquiryId: jobsTable.enquiryId,
      inspectionId: jobsTable.inspectionId,
      createdAt: jobsTable.createdAt,
    }).from(jobsTable)
      .leftJoin(customersTable, eq(jobsTable.customerId, customersTable.id))
      .where(and(B(jobsTable.branchId), notInArray(jobsTable.stage, ["won", "lost", "closed"])))
      .orderBy(desc(jobsTable.createdAt))
      .limit(5),

    // Stock snapshot
    db.select({
      id: stockLevelsTable.id,
      quantity: stockLevelsTable.quantity,
      itemName: stockItemsTable.name,
      itemUnit: stockItemsTable.unit,
      itemCategory: stockItemsTable.category,
    }).from(stockLevelsTable)
      .leftJoin(stockItemsTable, eq(stockLevelsTable.stockItemId, stockItemsTable.id))
      .where(eq(stockLevelsTable.branchId, branchId))
      .orderBy(stockLevelsTable.quantity)
      .limit(8),
  ]);

  if (!branch[0]) {
    res.status(404).json({ error: "Branch not found" });
    return;
  }

  // Jobs by stage
  const jobsByStage: Record<string, number> = {};
  for (const j of allJobsRaw) {
    jobsByStage[j.stage] = (jobsByStage[j.stage] ?? 0) + 1;
  }

  // Enquiry pipeline tracker linkage
  const enquiryIds = recentEnquiriesRaw.map((e) => e.id);
  const [linkedInspections, linkedJobs] = enquiryIds.length > 0
    ? await Promise.all([
        db.select({ id: inspectionsTable.id, enquiryId: inspectionsTable.enquiryId }).from(inspectionsTable).where(inArray(inspectionsTable.enquiryId, enquiryIds)),
        db.select({ id: jobsTable.id, enquiryId: jobsTable.enquiryId }).from(jobsTable).where(inArray(jobsTable.enquiryId, enquiryIds)),
      ])
    : [[], []];

  const inspectionByEnquiry: Record<number, number> = {};
  for (const i of linkedInspections) { if (i.enquiryId != null) inspectionByEnquiry[i.enquiryId] = i.id; }
  const jobByEnquiry: Record<number, number> = {};
  for (const j of linkedJobs) { if (j.enquiryId != null) jobByEnquiry[j.enquiryId] = j.id; }

  const recentEnquiries = recentEnquiriesRaw.map((e) => ({
    ...e,
    customerName: e.customerName ?? undefined,
    inspectionId: inspectionByEnquiry[e.id] ?? undefined,
    jobId: jobByEnquiry[e.id] ?? undefined,
  }));

  const recentJobs = recentJobsRaw.map((j) => ({
    ...j,
    customerName: j.customerName ?? undefined,
    inspectionId: j.inspectionId ?? undefined,
    enquiryId: j.enquiryId ?? undefined,
  }));

  const activeJobCount = allJobsRaw.filter((j) => !["won", "lost", "closed"].includes(j.stage)).length;

  res.json({
    branchId,
    branchName: branch[0].name,
    branchRegion: branch[0].region,
    totalCustomers: Number(customersRaw[0].count),
    totalEnquiries: Number(enquiriesRaw[0].count),
    totalJobs: activeJobCount,
    stockItemsTracked: stockSnapshot.length,
    staleEnquiries: Number(staleEnquiriesRaw[0].count),
    staleJobs: Number(staleJobsRaw[0].count),
    urgentEnquiries: Number(urgentEnquiriesRaw[0].count),
    urgentJobs: Number(urgentJobsRaw[0].count),
    newRecords: Number(newCustomersRaw[0].count) + Number(newEnquiriesRaw[0].count) + Number(newJobsRaw[0].count) + Number(newInspectionsRaw[0].count),
    overdueFollowUpEnquiries: Number(overdueFollowUpEnqRaw[0].count),
    overdueFollowUpJobs: Number(overdueFollowUpJobsRaw[0].count),
    noNextActionEnquiries: Number(noNextActionEnqRaw[0].count),
    noNextActionJobs: Number(noNextActionJobsRaw[0].count),
    quotedNoFollowUp: Number(quotedNoFollowUpRaw[0].count),
    lostNoReason: Number(lostNoReasonRaw[0].count),
    highAccessRiskJobs: Number(highRiskJobsRaw[0].count),
    lastChecked: schedulerState.lastSuccessfulCheck,
    jobsByStage,
    recentEnquiries,
    recentJobs,
    stockSnapshot,
  });
});

export default router;
