import { gt, lt, count, and, inArray, notInArray, eq, isNull, or, sql } from "drizzle-orm";
import { db, customersTable, enquiriesTable, jobsTable, inspectionsTable } from "@workspace/db";
import { logger } from "./lib/logger";
import { loadSchedulerState, saveSchedulerState, INTERVAL_MS, STALE_MS, type SchedulerCounts } from "./lib/scheduler-state";
import { notifyAdmins } from "./lib/notify";
import { runLeadScraper } from "./lib/lead-scraper-runner";

async function runCheck(): Promise<void> {
  const runAt = new Date();
  const state = loadSchedulerState();
  const since = new Date(state.lastSuccessfulCheck);
  const staleThreshold = new Date(runAt.getTime() - STALE_MS);

  logger.info("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  logger.info(`[scheduler] Run started:  ${runAt.toISOString()}`);
  logger.info(`[scheduler] New records since: ${since.toISOString()}`);
  logger.info(`[scheduler] Stale threshold:   ${staleThreshold.toISOString()}`);

  const today = new Date().toISOString().slice(0, 10);

  const [
    customers,
    enquiries,
    jobs,
    inspections,
    staleEnquiries,
    staleJobs,
    urgentEnquiries,
    urgentJobs,
    overdueFollowUpEnquiries,
    overdueFollowUpJobs,
    noNextActionEnquiries,
    noNextActionJobs,
    quotedNoFollowUp,
    lostNoReason,
    highAccessRiskJobs,
  ] = await Promise.all([
    // New records since last check
    db.select({ count: count() }).from(customersTable).where(gt(customersTable.createdAt, since)),
    db.select({ count: count() }).from(enquiriesTable).where(gt(enquiriesTable.createdAt, since)),
    db.select({ count: count() }).from(jobsTable).where(gt(jobsTable.createdAt, since)),
    db.select({ count: count() }).from(inspectionsTable).where(gt(inspectionsTable.createdAt, since)),

    // Stale enquiries: status new or in_progress, updatedAt older than 48 hours
    db.select({ count: count() }).from(enquiriesTable).where(
      and(
        inArray(enquiriesTable.status, ["new", "in_progress"]),
        lt(enquiriesTable.updatedAt, staleThreshold),
      ),
    ),

    // Stale jobs: stage not won/lost/closed, updatedAt older than 48 hours
    db.select({ count: count() }).from(jobsTable).where(
      and(
        notInArray(jobsTable.stage, ["won", "lost", "closed"]),
        lt(jobsTable.updatedAt, staleThreshold),
      ),
    ),

    // Urgent enquiries: priority high
    db.select({ count: count() }).from(enquiriesTable).where(eq(enquiriesTable.priority, "high")),

    // Urgent jobs: priority high
    db.select({ count: count() }).from(jobsTable).where(eq(jobsTable.priority, "high")),

    // Overdue follow-up: active enquiry with follow_up_due_date in the past
    db.select({ count: count() }).from(enquiriesTable).where(
      and(
        notInArray(enquiriesTable.status, ["won", "lost", "closed"]),
        sql`${enquiriesTable.followUpDueDate} is not null`,
        sql`${enquiriesTable.followUpDueDate} < ${today}`,
      ),
    ),

    // Overdue follow-up: active job with follow_up_due_date in the past
    db.select({ count: count() }).from(jobsTable).where(
      and(
        notInArray(jobsTable.stage, ["won", "lost", "closed"]),
        sql`${jobsTable.followUpDueDate} is not null`,
        sql`${jobsTable.followUpDueDate} < ${today}`,
      ),
    ),

    // No next action: active enquiry with next_action null or empty string
    db.select({ count: count() }).from(enquiriesTable).where(
      and(
        notInArray(enquiriesTable.status, ["won", "lost", "closed"]),
        or(isNull(enquiriesTable.nextAction), eq(enquiriesTable.nextAction, "")),
      ),
    ),

    // No next action: active job with next_action null or empty string
    db.select({ count: count() }).from(jobsTable).where(
      and(
        notInArray(jobsTable.stage, ["won", "lost", "closed"]),
        or(isNull(jobsTable.nextAction), eq(jobsTable.nextAction, "")),
      ),
    ),

    // Quoted job with no follow-up date set
    db.select({ count: count() }).from(jobsTable).where(
      and(
        eq(jobsTable.stage, "quoted"),
        isNull(jobsTable.followUpDueDate),
      ),
    ),

    // Lost job with no lost reason recorded
    db.select({ count: count() }).from(jobsTable).where(
      and(
        eq(jobsTable.stage, "lost"),
        isNull(jobsTable.lostReason),
      ),
    ),

    // Jobs with high access risk (any stage)
    db.select({ count: count() }).from(jobsTable).where(eq(jobsTable.accessRisk, "high")),
  ]);

  logger.info("[scheduler] ── New records ─────────────────────────");
  logger.info(`[scheduler]   New customers:        ${customers[0].count}`);
  logger.info(`[scheduler]   New enquiries:        ${enquiries[0].count}`);
  logger.info(`[scheduler]   New jobs:             ${jobs[0].count}`);
  logger.info(`[scheduler]   New inspections:      ${inspections[0].count}`);
  logger.info("[scheduler] ── Stale (>48h, open) ─────────────────");
  logger.info(`[scheduler]   Stale enquiries:      ${staleEnquiries[0].count}`);
  logger.info(`[scheduler]   Stale jobs:           ${staleJobs[0].count}`);
  logger.info("[scheduler] ── Urgent (priority high) ──────────────");
  logger.info(`[scheduler]   Urgent enquiries:     ${urgentEnquiries[0].count}`);
  logger.info(`[scheduler]   Urgent jobs:          ${urgentJobs[0].count}`);
  logger.info("[scheduler] ── Data quality ────────────────────────");
  logger.info(`[scheduler]   Overdue follow-up enq: ${overdueFollowUpEnquiries[0].count}`);
  logger.info(`[scheduler]   Overdue follow-up jobs: ${overdueFollowUpJobs[0].count}`);
  logger.info(`[scheduler]   No next action enq:    ${noNextActionEnquiries[0].count}`);
  logger.info(`[scheduler]   No next action jobs:   ${noNextActionJobs[0].count}`);
  logger.info(`[scheduler]   Quoted, no follow-up:  ${quotedNoFollowUp[0].count}`);
  logger.info(`[scheduler]   Lost, no reason:       ${lostNoReason[0].count}`);
  logger.info(`[scheduler]   High access risk:      ${highAccessRiskJobs[0].count}`);
  logger.info("─────────────────────────────────────────────────");

  const currentCounts: SchedulerCounts = {
    newRecords: customers[0].count + enquiries[0].count + jobs[0].count + inspections[0].count,
    staleEnquiries: staleEnquiries[0].count,
    staleJobs: staleJobs[0].count,
    urgentEnquiries: urgentEnquiries[0].count,
    urgentJobs: urgentJobs[0].count,
    overdueFollowUpEnquiries: overdueFollowUpEnquiries[0].count,
    overdueFollowUpJobs: overdueFollowUpJobs[0].count,
    noNextActionEnquiries: noNextActionEnquiries[0].count,
    noNextActionJobs: noNextActionJobs[0].count,
    quotedNoFollowUp: quotedNoFollowUp[0].count,
    lostNoReason: lostNoReason[0].count,
    highAccessRiskJobs: highAccessRiskJobs[0].count,
  };

  // Only notify admins when genuinely new records have arrived since the last run.
  // Persistent aggregate issues (stale, urgent, overdue) are logged for monitoring
  // but do NOT generate notifications — those are handled event-driven in the routes.
  const newEnquiries = enquiries[0].count;
  const newJobs = jobs[0].count;
  const newCustomers = customers[0].count;
  const newInspections = inspections[0].count;
  const newRecordsTotal = currentCounts.newRecords;

  if (newRecordsTotal > 0) {
    const parts: string[] = [];
    if (newEnquiries > 0) parts.push(`${newEnquiries} new enquir${newEnquiries !== 1 ? "ies" : "y"}`);
    if (newJobs > 0) parts.push(`${newJobs} new job${newJobs !== 1 ? "s" : ""}`);
    if (newCustomers > 0) parts.push(`${newCustomers} new customer${newCustomers !== 1 ? "s" : ""}`);
    if (newInspections > 0) parts.push(`${newInspections} new inspection${newInspections !== 1 ? "s" : ""}`);
    const body = parts.join(", ");
    logger.info(`[scheduler] Notifying admins: ${body}`);
    await notifyAdmins("New activity", body, "/dashboard");
  } else {
    logger.info("[scheduler] No new records since last check — no notification sent");
  }

  // ── Daily lead scraper ─────────────────────────────────────
  const todayDate = today;
  if (state.lastLeadScrapeDate !== todayDate) {
    logger.info("[scheduler] Running daily lead scraper...");
    try {
      const scrapeResult = await runLeadScraper();
      logger.info(`[scheduler] Lead scraper: created=${scrapeResult.created} skipped=${scrapeResult.skipped} errors=${scrapeResult.errors}`);
      if (scrapeResult.created > 0) {
        await notifyAdmins(
          "New scraped leads",
          `${scrapeResult.created} new lead${scrapeResult.created !== 1 ? "s" : ""} found and added to enquiries`,
          "/enquiries",
        );
      }
      saveSchedulerState({ lastSuccessfulCheck: runAt.toISOString(), lastNotifiedCounts: currentCounts, lastLeadScrapeDate: todayDate });
    } catch (err) {
      logger.error({ err }, "[scheduler] Lead scraper failed");
      saveSchedulerState({ lastSuccessfulCheck: runAt.toISOString(), lastNotifiedCounts: currentCounts });
    }
  } else {
    logger.info(`[scheduler] Lead scraper already ran today (${todayDate}) — skipping`);
    saveSchedulerState({ lastSuccessfulCheck: runAt.toISOString(), lastNotifiedCounts: currentCounts, lastLeadScrapeDate: state.lastLeadScrapeDate });
  }

  logger.info(`[scheduler] Timestamp saved: ${runAt.toISOString()}`);
  logger.info("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
}

export function startScheduler(): void {
  logger.info("[scheduler] Starting — interval: 30 minutes");

  const attempt = () => {
    runCheck().catch((err) => {
      logger.error({ err }, "[scheduler] Run FAILED — last successful timestamp preserved");
    });
  };

  attempt();
  setInterval(attempt, INTERVAL_MS);
}
