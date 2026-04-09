import { gt, lt, count, and, inArray, notInArray, eq, isNull, sql } from "drizzle-orm";
import { db, customersTable, enquiriesTable, jobsTable, inspectionsTable } from "@workspace/db";
import { logger } from "./lib/logger";
import { loadSchedulerState, saveSchedulerState, INTERVAL_MS, STALE_MS, type SchedulerCounts } from "./lib/scheduler-state";
import { notifyAdmins } from "./lib/notify";

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

    // No next action: active enquiry missing next_action
    db.select({ count: count() }).from(enquiriesTable).where(
      and(
        notInArray(enquiriesTable.status, ["won", "lost", "closed"]),
        isNull(enquiriesTable.nextAction),
      ),
    ),

    // No next action: active job missing next_action
    db.select({ count: count() }).from(jobsTable).where(
      and(
        notInArray(jobsTable.stage, ["won", "lost", "closed"]),
        isNull(jobsTable.nextAction),
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

  const prev = state.lastNotifiedCounts;
  const countsChanged = !prev ||
    (Object.keys(currentCounts) as (keyof SchedulerCounts)[]).some(
      (k) => prev[k] !== currentCounts[k],
    );

  const anyAboveZero = Object.values(currentCounts).some((v) => v > 0);

  if (anyAboveZero && countsChanged) {
    const parts: string[] = [];
    if (currentCounts.newRecords > 0) parts.push(`${currentCounts.newRecords} new record${currentCounts.newRecords !== 1 ? "s" : ""}`);
    if (currentCounts.staleEnquiries > 0) parts.push(`${currentCounts.staleEnquiries} stale enquir${currentCounts.staleEnquiries !== 1 ? "ies" : "y"}`);
    if (currentCounts.staleJobs > 0) parts.push(`${currentCounts.staleJobs} stale job${currentCounts.staleJobs !== 1 ? "s" : ""}`);
    if (currentCounts.urgentEnquiries > 0) parts.push(`${currentCounts.urgentEnquiries} urgent enquir${currentCounts.urgentEnquiries !== 1 ? "ies" : "y"}`);
    if (currentCounts.urgentJobs > 0) parts.push(`${currentCounts.urgentJobs} urgent job${currentCounts.urgentJobs !== 1 ? "s" : ""}`);
    if (currentCounts.overdueFollowUpEnquiries > 0) parts.push(`${currentCounts.overdueFollowUpEnquiries} overdue follow-up enquir${currentCounts.overdueFollowUpEnquiries !== 1 ? "ies" : "y"}`);
    if (currentCounts.overdueFollowUpJobs > 0) parts.push(`${currentCounts.overdueFollowUpJobs} overdue follow-up job${currentCounts.overdueFollowUpJobs !== 1 ? "s" : ""}`);
    if (currentCounts.noNextActionEnquiries > 0) parts.push(`${currentCounts.noNextActionEnquiries} enquir${currentCounts.noNextActionEnquiries !== 1 ? "ies" : "y"} with no next action`);
    if (currentCounts.noNextActionJobs > 0) parts.push(`${currentCounts.noNextActionJobs} job${currentCounts.noNextActionJobs !== 1 ? "s" : ""} with no next action`);
    if (currentCounts.quotedNoFollowUp > 0) parts.push(`${currentCounts.quotedNoFollowUp} quoted job${currentCounts.quotedNoFollowUp !== 1 ? "s" : ""} with no follow-up date`);
    if (currentCounts.lostNoReason > 0) parts.push(`${currentCounts.lostNoReason} lost job${currentCounts.lostNoReason !== 1 ? "s" : ""} with no reason`);
    if (currentCounts.highAccessRiskJobs > 0) parts.push(`${currentCounts.highAccessRiskJobs} high access risk job${currentCounts.highAccessRiskJobs !== 1 ? "s" : ""}`);

    const body = parts.join(", ");
    logger.info(`[scheduler] Notifying admins: ${body}`);
    await notifyAdmins("Scheduler alert", body, "/dashboard");
  } else if (!anyAboveZero) {
    logger.info("[scheduler] All counts zero — no notification sent");
  } else {
    logger.info("[scheduler] Counts unchanged since last notification — skipping");
  }

  saveSchedulerState({ lastSuccessfulCheck: runAt.toISOString(), lastNotifiedCounts: currentCounts });
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
