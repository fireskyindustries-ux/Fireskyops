import { Router, type IRouter } from "express";
import { desc, gte, lte, and, eq, notInArray, sql, count, sum } from "drizzle-orm";
import { db, customersTable, enquiriesTable, jobsTable, inspectionsTable, branchesTable } from "@workspace/db";
import { isAdmin, getBranchId } from "../middlewares/requireAuth";

const router: IRouter = Router();

router.get("/analytics", async (req, res): Promise<void> => {
  const adminUser = isAdmin(req);
  const userBranchId = getBranchId(req);

  // Date range filter
  const fromStr = req.query.from as string | undefined;
  const toStr = req.query.to as string | undefined;
  const fromDate = fromStr ? new Date(fromStr) : undefined;
  const toDate = toStr ? new Date(toStr) : undefined;

  // Scoping: admin sees all (or filtered by branchId param), branch_admin sees their branch
  const scopeBranchId: number | null = adminUser
    ? req.query.branchId ? Number(req.query.branchId) : null
    : (userBranchId ?? null);

  function dateWhere(col: any) {
    const clauses = [];
    if (fromDate) clauses.push(gte(col, fromDate));
    if (toDate) clauses.push(lte(col, toDate));
    if (scopeBranchId) clauses.push(eq(col === enquiriesTable.createdAt ? enquiriesTable.branchId : col === jobsTable.createdAt ? jobsTable.branchId : col === customersTable.createdAt ? customersTable.branchId : inspectionsTable.branchId, scopeBranchId));
    return clauses.length > 0 ? and(...clauses) : undefined;
  }

  // Fetch raw data — volumes are small enough to aggregate in JS
  const [enquiries, jobs, customers, inspections, branches] = await Promise.all([
    db.select({
      id: enquiriesTable.id,
      status: enquiriesTable.status,
      priority: enquiriesTable.priority,
      branchId: enquiriesTable.branchId,
      createdAt: enquiriesTable.createdAt,
      tankSize: enquiriesTable.tankSize,
      tankQuantity: enquiriesTable.tankQuantity,
    }).from(enquiriesTable).where(
      scopeBranchId
        ? and(
            eq(enquiriesTable.branchId, scopeBranchId),
            fromDate ? gte(enquiriesTable.createdAt, fromDate) : undefined,
            toDate ? lte(enquiriesTable.createdAt, toDate) : undefined,
          )
        : and(
            fromDate ? gte(enquiriesTable.createdAt, fromDate) : undefined,
            toDate ? lte(enquiriesTable.createdAt, toDate) : undefined,
          )
    ),

    db.select({
      id: jobsTable.id,
      stage: jobsTable.stage,
      priority: jobsTable.priority,
      branchId: jobsTable.branchId,
      estimatedValue: jobsTable.estimatedValue,
      createdAt: jobsTable.createdAt,
      tankSize: jobsTable.tankSize,
      tankQuantity: jobsTable.tankQuantity,
    }).from(jobsTable).where(
      scopeBranchId
        ? and(
            eq(jobsTable.branchId, scopeBranchId),
            fromDate ? gte(jobsTable.createdAt, fromDate) : undefined,
            toDate ? lte(jobsTable.createdAt, toDate) : undefined,
          )
        : and(
            fromDate ? gte(jobsTable.createdAt, fromDate) : undefined,
            toDate ? lte(jobsTable.createdAt, toDate) : undefined,
          )
    ),

    db.select({
      id: customersTable.id,
      branchId: customersTable.branchId,
      createdAt: customersTable.createdAt,
    }).from(customersTable).where(
      scopeBranchId
        ? and(
            eq(customersTable.branchId, scopeBranchId),
            fromDate ? gte(customersTable.createdAt, fromDate) : undefined,
            toDate ? lte(customersTable.createdAt, toDate) : undefined,
          )
        : and(
            fromDate ? gte(customersTable.createdAt, fromDate) : undefined,
            toDate ? lte(customersTable.createdAt, toDate) : undefined,
          )
    ),

    db.select({
      id: inspectionsTable.id,
      branchId: inspectionsTable.branchId,
      createdAt: inspectionsTable.createdAt,
    }).from(inspectionsTable).where(
      scopeBranchId
        ? and(
            eq(inspectionsTable.branchId, scopeBranchId),
            fromDate ? gte(inspectionsTable.createdAt, fromDate) : undefined,
            toDate ? lte(inspectionsTable.createdAt, toDate) : undefined,
          )
        : and(
            fromDate ? gte(inspectionsTable.createdAt, fromDate) : undefined,
            toDate ? lte(inspectionsTable.createdAt, toDate) : undefined,
          )
    ),

    adminUser ? db.select().from(branchesTable).orderBy(branchesTable.id) : Promise.resolve([]),
  ]);

  // ── Aggregate helpers ─────────────────────────────────────────
  function monthKey(date: Date | string): string {
    const d = new Date(date);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
  }

  function monthLabel(key: string): string {
    const [y, m] = key.split("-");
    const d = new Date(Number(y), Number(m) - 1, 1);
    return d.toLocaleString("en-ZA", { month: "short", year: "2-digit" });
  }

  // Build month buckets for last 13 months
  const now = new Date();
  const monthBuckets: string[] = [];
  for (let i = 12; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    monthBuckets.push(monthKey(d));
  }

  // ── Enquiry breakdowns ────────────────────────────────────────
  const enquiryByStatus: Record<string, number> = {};
  const enquiryByPriority: Record<string, number> = {};
  const enquiryByMonth: Record<string, number> = {};
  for (const e of enquiries) {
    enquiryByStatus[e.status] = (enquiryByStatus[e.status] ?? 0) + 1;
    enquiryByPriority[e.priority ?? "unset"] = (enquiryByPriority[e.priority ?? "unset"] ?? 0) + 1;
    const mk = monthKey(e.createdAt);
    if (monthBuckets.includes(mk)) enquiryByMonth[mk] = (enquiryByMonth[mk] ?? 0) + 1;
  }

  // ── Job breakdowns ────────────────────────────────────────────
  const jobByStage: Record<string, number> = {};
  const jobByPriority: Record<string, number> = {};
  const jobByMonth: Record<string, number> = {};
  const jobsWonByMonth: Record<string, number> = {};
  const pipelineValueByStage: Record<string, { value: number; count: number }> = {};
  let totalPipelineValue = 0;

  for (const j of jobs) {
    jobByStage[j.stage] = (jobByStage[j.stage] ?? 0) + 1;
    jobByPriority[j.priority ?? "unset"] = (jobByPriority[j.priority ?? "unset"] ?? 0) + 1;
    const mk = monthKey(j.createdAt);
    if (monthBuckets.includes(mk)) {
      jobByMonth[mk] = (jobByMonth[mk] ?? 0) + 1;
      if (j.stage === "won") jobsWonByMonth[mk] = (jobsWonByMonth[mk] ?? 0) + 1;
    }
    const val = Number(j.estimatedValue ?? 0);
    if (!pipelineValueByStage[j.stage]) pipelineValueByStage[j.stage] = { value: 0, count: 0 };
    pipelineValueByStage[j.stage].value += val;
    pipelineValueByStage[j.stage].count += 1;
    if (!["won", "lost", "closed"].includes(j.stage)) totalPipelineValue += val;
  }

  // ── Customer by month ─────────────────────────────────────────
  const customersByMonth: Record<string, number> = {};
  for (const c of customers) {
    const mk = monthKey(c.createdAt);
    if (monthBuckets.includes(mk)) customersByMonth[mk] = (customersByMonth[mk] ?? 0) + 1;
  }

  // ── Monthly trend array ───────────────────────────────────────
  const monthlyTrend = monthBuckets.map(mk => ({
    month: monthLabel(mk),
    key: mk,
    enquiries: enquiryByMonth[mk] ?? 0,
    jobs: jobByMonth[mk] ?? 0,
    jobsWon: jobsWonByMonth[mk] ?? 0,
    customers: customersByMonth[mk] ?? 0,
  }));

  // ── Won / Lost ────────────────────────────────────────────────
  const wonJobs = jobByStage["won"] ?? 0;
  const lostJobs = jobByStage["lost"] ?? 0;

  // ── Conversion funnel ─────────────────────────────────────────
  const totalEnquiries = enquiries.length;
  const inspectionDoneEnquiries = enquiries.filter(e =>
    ["inspection_done", "quoted", "won"].includes(e.status)
  ).length;
  const quotedEnquiries = enquiries.filter(e => ["quoted", "won"].includes(e.status)).length;
  const wonEnquiries = enquiries.filter(e => e.status === "won").length;

  // ── Tank size breakdown ───────────────────────────────────────
  const tankSizeCounts: Record<string, number> = {};
  for (const e of enquiries) {
    if (e.tankSize) tankSizeCounts[e.tankSize] = (tankSizeCounts[e.tankSize] ?? 0) + (e.tankQuantity ?? 1);
  }
  for (const j of jobs) {
    if (j.tankSize) tankSizeCounts[j.tankSize] = (tankSizeCounts[j.tankSize] ?? 0) + (j.tankQuantity ?? 1);
  }
  const topTankSizes = Object.entries(tankSizeCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8)
    .map(([size, count]) => ({ size, count }));

  // ── Branch comparison (admin only) ────────────────────────────
  let branchComparison: any[] = [];
  if (adminUser && branches.length > 0) {
    branchComparison = branches.map(b => {
      const bEnquiries = enquiries.filter(e => e.branchId === b.id);
      const bJobs = jobs.filter(j => j.branchId === b.id);
      const bCustomers = customers.filter(c => c.branchId === b.id);
      const bActiveJobs = bJobs.filter(j => !["won", "lost", "closed"].includes(j.stage));
      const bPipelineValue = bActiveJobs.reduce((s, j) => s + Number(j.estimatedValue ?? 0), 0);
      return {
        branchId: b.id,
        branchName: b.name,
        customers: bCustomers.length,
        enquiries: bEnquiries.length,
        jobs: bJobs.length,
        wonJobs: bJobs.filter(j => j.stage === "won").length,
        activeJobs: bActiveJobs.length,
        pipelineValue: bPipelineValue,
      };
    });
  }

  // ── Build response ────────────────────────────────────────────
  const ENQUIRY_STATUSES = ["new", "in_progress", "inspection_done", "quoted", "won", "lost", "closed"];
  const JOB_STAGES = ["enquiry", "inspection", "quoting", "quoted", "won", "lost", "closed"];

  res.json({
    summary: {
      totalEnquiries,
      totalJobs: jobs.length,
      totalCustomers: customers.length,
      totalInspections: inspections.length,
      wonJobs,
      lostJobs,
      activeJobs: jobs.filter(j => !["won", "lost", "closed"].includes(j.stage)).length,
      conversionRate: totalEnquiries > 0 ? Math.round((wonEnquiries / totalEnquiries) * 1000) / 10 : 0,
      totalPipelineValue,
    },
    enquiryByStatus: ENQUIRY_STATUSES.map(s => ({ status: s, count: enquiryByStatus[s] ?? 0 })),
    jobByStage: JOB_STAGES.map(s => ({ stage: s, count: jobByStage[s] ?? 0 })),
    monthlyTrend,
    wonLost: [
      { name: "Won", value: wonJobs },
      { name: "Lost", value: lostJobs },
      { name: "Active", value: jobs.filter(j => !["won", "lost", "closed"].includes(j.stage)).length },
    ],
    pipelineValue: JOB_STAGES.filter(s => !["lost", "closed"].includes(s)).map(s => ({
      stage: s,
      value: Math.round(pipelineValueByStage[s]?.value ?? 0),
      count: pipelineValueByStage[s]?.count ?? 0,
    })),
    priorityBreakdown: ["high", "medium", "low"].map(p => ({
      priority: p,
      enquiries: enquiryByPriority[p] ?? 0,
      jobs: jobByPriority[p] ?? 0,
    })),
    conversionFunnel: [
      { label: "Enquiries", count: totalEnquiries },
      { label: "Inspection Done", count: inspectionDoneEnquiries },
      { label: "Quoted", count: quotedEnquiries },
      { label: "Won", count: wonEnquiries },
    ],
    topTankSizes,
    branchComparison,
  });
});

export default router;
