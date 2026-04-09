import { gt, lt, count, and, inArray, notInArray, eq } from "drizzle-orm";
import { db, customersTable, enquiriesTable, jobsTable, inspectionsTable } from "@workspace/db";
import { logger } from "./lib/logger";
import { loadSchedulerState, saveSchedulerState, INTERVAL_MS, STALE_MS } from "./lib/scheduler-state";

async function runCheck(): Promise<void> {
  const runAt = new Date();
  const state = loadSchedulerState();
  const since = new Date(state.lastSuccessfulCheck);
  const staleThreshold = new Date(runAt.getTime() - STALE_MS);

  logger.info("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  logger.info(`[scheduler] Run started:  ${runAt.toISOString()}`);
  logger.info(`[scheduler] New records since: ${since.toISOString()}`);
  logger.info(`[scheduler] Stale threshold:   ${staleThreshold.toISOString()}`);

  const [
    customers,
    enquiries,
    jobs,
    inspections,
    staleEnquiries,
    staleJobs,
    urgentEnquiries,
    urgentJobs,
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
  logger.info("─────────────────────────────────────────────────");

  saveSchedulerState({ lastSuccessfulCheck: runAt.toISOString() });
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
