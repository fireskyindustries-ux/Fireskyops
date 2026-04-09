import { readFileSync, writeFileSync, mkdirSync, existsSync } from "fs";
import path from "path";
import { gt, count } from "drizzle-orm";
import { db, customersTable, enquiriesTable, jobsTable, inspectionsTable } from "@workspace/db";
import { logger } from "./lib/logger";

const STATE_DIR = path.join(process.cwd(), "data");
const STATE_FILE = path.join(STATE_DIR, "scheduler-state.json");
const INTERVAL_MS = 30 * 60 * 1000;

interface SchedulerState {
  lastSuccessfulCheck: string;
}

function loadState(): SchedulerState {
  try {
    if (existsSync(STATE_FILE)) {
      const raw = readFileSync(STATE_FILE, "utf-8");
      const parsed = JSON.parse(raw) as SchedulerState;
      if (parsed.lastSuccessfulCheck) return parsed;
    }
  } catch (err) {
    logger.warn({ err }, "[scheduler] Could not read state file — using default");
  }
  return { lastSuccessfulCheck: new Date(Date.now() - INTERVAL_MS).toISOString() };
}

function saveState(state: SchedulerState): void {
  if (!existsSync(STATE_DIR)) {
    mkdirSync(STATE_DIR, { recursive: true });
  }
  writeFileSync(STATE_FILE, JSON.stringify(state, null, 2), "utf-8");
}

async function runCheck(): Promise<void> {
  const runAt = new Date();
  const state = loadState();
  const since = new Date(state.lastSuccessfulCheck);

  logger.info("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  logger.info(`[scheduler] Run started:  ${runAt.toISOString()}`);
  logger.info(`[scheduler] Checking for records created after: ${since.toISOString()}`);

  const [customers, enquiries, jobs, inspections] = await Promise.all([
    db.select({ count: count() }).from(customersTable).where(gt(customersTable.createdAt, since)),
    db.select({ count: count() }).from(enquiriesTable).where(gt(enquiriesTable.createdAt, since)),
    db.select({ count: count() }).from(jobsTable).where(gt(jobsTable.createdAt, since)),
    db.select({ count: count() }).from(inspectionsTable).where(gt(inspectionsTable.createdAt, since)),
  ]);

  logger.info("[scheduler] ── New records ─────────────────────────");
  logger.info(`[scheduler]   New customers:   ${customers[0].count}`);
  logger.info(`[scheduler]   New enquiries:   ${enquiries[0].count}`);
  logger.info(`[scheduler]   New jobs:        ${jobs[0].count}`);
  logger.info(`[scheduler]   New inspections: ${inspections[0].count}`);
  logger.info("─────────────────────────────────────────────────");

  saveState({ lastSuccessfulCheck: runAt.toISOString() });
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
