import { readFileSync, writeFileSync, mkdirSync, existsSync } from "fs";
import path from "path";

const STATE_DIR = path.join(process.cwd(), "data");
const STATE_FILE = path.join(STATE_DIR, "scheduler-state.json");

export interface SchedulerCounts {
  newRecords: number;
  staleEnquiries: number;
  staleJobs: number;
  urgentEnquiries: number;
  urgentJobs: number;
  overdueFollowUpEnquiries: number;
  overdueFollowUpJobs: number;
  noNextActionEnquiries: number;
  noNextActionJobs: number;
  quotedNoFollowUp: number;
  lostNoReason: number;
  highAccessRiskJobs: number;
}

export interface SchedulerState {
  lastSuccessfulCheck: string;
  lastNotifiedCounts?: SchedulerCounts;
}

export const INTERVAL_MS = 30 * 60 * 1000;
export const STALE_MS = 48 * 60 * 60 * 1000;

export function loadSchedulerState(): SchedulerState {
  try {
    if (existsSync(STATE_FILE)) {
      const raw = readFileSync(STATE_FILE, "utf-8");
      const parsed = JSON.parse(raw) as SchedulerState;
      if (parsed.lastSuccessfulCheck) return parsed;
    }
  } catch {}
  return { lastSuccessfulCheck: new Date(Date.now() - INTERVAL_MS).toISOString() };
}

export function saveSchedulerState(state: SchedulerState): void {
  if (!existsSync(STATE_DIR)) mkdirSync(STATE_DIR, { recursive: true });
  writeFileSync(STATE_FILE, JSON.stringify(state, null, 2), "utf-8");
}
