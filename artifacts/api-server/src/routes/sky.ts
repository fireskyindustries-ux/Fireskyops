import { Router } from "express";
import { eq, desc } from "drizzle-orm";
import { openai } from "@workspace/integrations-openai-ai-server";
import {
  db,
  customersTable,
  enquiriesTable,
  jobsTable,
  inspectionsTable,
} from "@workspace/db";
import { requireAdmin } from "../middlewares/requireAuth";

const router = Router();

// ─── System prompt ───────────────────────────────────────────────────────────

const FIRESKY_SYSTEM_PROMPT = `You are Sky, the built-in AI assistant and operational brain for Firesky Industries. You are warm, knowledgeable, and genuinely happy to help. Every person you speak with is a valued member of the Firesky team, and you treat them with a friendly, welcoming tone.

Firesky Industries installs water tanks at farms and remote rural properties across South Africa. Your role is to assist the field team and management with practical, grounded guidance.

Tank naming rule: Always refer to water tanks as "our tanks". Never mention any tank brand, manufacturer, or trade name.

Your areas of expertise:
- Tank sizing and capacity recommendations for agricultural and rural use
- Stand vs plinth decisions and when each is appropriate
- Site inspection completeness: flag missing measurements, access information, or unconfirmed readiness
- Pipe lengths and distances: check inlet, outlet, and overflow runs
- Delivery and access risk: flag difficult road access, low overhead clearances, soft ground
- Quote readiness: determine whether an inspection has enough captured data to generate a quotation
- Business pipeline analysis: identifying stalled jobs, overdue follow-ups, prioritisation

For admin users: You have live access to the entire Firesky database and can take action. When an admin asks you to close a job, update a stage, change a status, add notes, or modify any record, use your available tools to do it directly — do not ask them to do it manually. After taking an action, confirm clearly what was done.

Tone and style:
- Warm, friendly, and welcoming. Greet people by name when you know it.
- Clear and practical. The team is often on a phone in the field.
- Use proper grammar at all times with correct punctuation.
- Do not use markdown formatting symbols such as ** or ##.
- When listing items, use a simple dash and space at the start of each point on its own line.
- Group related information under plain-text headings followed by a colon.
- Never use emoji.`;

// ─── Tool definitions ─────────────────────────────────────────────────────────

const ADMIN_TOOLS = [
  {
    type: "function" as const,
    function: {
      name: "close_job",
      description: "Close a job with a specific outcome. Use when the admin says a job is won, lost, or cancelled.",
      parameters: {
        type: "object",
        properties: {
          job_id: { type: "integer", description: "The job ID to close" },
          outcome: {
            type: "string",
            enum: ["won", "lost", "closed"],
            description: "won = successfully sold and installed, lost = customer went elsewhere, closed = cancelled or abandoned",
          },
        },
        required: ["job_id", "outcome"],
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "set_job_stage",
      description: "Move a job to a different pipeline stage. Use when the admin wants to advance or change a job's status.",
      parameters: {
        type: "object",
        properties: {
          job_id: { type: "integer" },
          stage: {
            type: "string",
            enum: ["enquiry", "inspection", "quoting", "quoted", "won", "lost", "closed"],
          },
        },
        required: ["job_id", "stage"],
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "set_job_priority",
      description: "Update the priority level of a job.",
      parameters: {
        type: "object",
        properties: {
          job_id: { type: "integer" },
          priority: { type: "string", enum: ["low", "medium", "high"] },
        },
        required: ["job_id", "priority"],
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "add_job_notes",
      description: "Add or replace notes on a job. Use when the admin wants to record information or updates on a job.",
      parameters: {
        type: "object",
        properties: {
          job_id: { type: "integer" },
          notes: { type: "string", description: "The notes to set on the job" },
        },
        required: ["job_id", "notes"],
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "set_enquiry_status",
      description: "Update the status of an enquiry.",
      parameters: {
        type: "object",
        properties: {
          enquiry_id: { type: "integer" },
          status: { type: "string", enum: ["new", "in_progress", "closed"] },
        },
        required: ["enquiry_id", "status"],
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "add_enquiry_notes",
      description: "Add or update notes on an enquiry.",
      parameters: {
        type: "object",
        properties: {
          enquiry_id: { type: "integer" },
          notes: { type: "string" },
        },
        required: ["enquiry_id", "notes"],
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "mark_inspection_ready",
      description: "Mark a site inspection as ready or not ready to quote.",
      parameters: {
        type: "object",
        properties: {
          inspection_id: { type: "integer" },
          ready: { type: "boolean", description: "true = ready to quote, false = not ready" },
          notes: { type: "string", description: "Optional notes to add to the inspection" },
        },
        required: ["inspection_id", "ready"],
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "add_inspection_notes",
      description: "Add or update notes on a site inspection.",
      parameters: {
        type: "object",
        properties: {
          inspection_id: { type: "integer" },
          notes: { type: "string" },
        },
        required: ["inspection_id", "notes"],
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "get_record",
      description: "Retrieve the full details of a specific job, inspection, enquiry, or customer by ID. Call this whenever you need the complete record to answer a question or take an action.",
      parameters: {
        type: "object",
        properties: {
          record_type: {
            type: "string",
            enum: ["job", "inspection", "enquiry", "customer"],
          },
          id: { type: "integer" },
        },
        required: ["record_type", "id"],
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "list_records",
      description: "List jobs, inspections, or enquiries with an optional filter. Use this to get up-to-date lists beyond what the system snapshot provides.",
      parameters: {
        type: "object",
        properties: {
          record_type: {
            type: "string",
            enum: ["jobs", "inspections", "enquiries", "customers"],
          },
          filter: {
            type: "string",
            description: "Optional: for jobs use a stage name (quoting, quoted, etc.), for enquiries use a status (new, in_progress, closed), for inspections use 'unconverted' or 'ready'",
          },
        },
        required: ["record_type"],
      },
    },
  },
] as const;

// ─── Tool execution ──────────────────────────────────────────────────────────

type ToolResult = {
  result: string;
  action?: { resource: string; id?: number };
};

async function executeTool(name: string, args: Record<string, any>): Promise<ToolResult> {
  try {
    switch (name) {
      case "close_job": {
        const rows = await db
          .update(jobsTable)
          .set({ stage: args.outcome, updatedAt: new Date() })
          .where(eq(jobsTable.id, args.job_id))
          .returning({ id: jobsTable.id, title: jobsTable.title });
        if (!rows.length) return { result: `Job #${args.job_id} not found.` };
        return {
          result: `Job #${args.job_id} ("${rows[0].title}") has been marked as ${args.outcome}.`,
          action: { resource: "jobs", id: args.job_id },
        };
      }

      case "set_job_stage": {
        const rows = await db
          .update(jobsTable)
          .set({ stage: args.stage, updatedAt: new Date() })
          .where(eq(jobsTable.id, args.job_id))
          .returning({ id: jobsTable.id, title: jobsTable.title });
        if (!rows.length) return { result: `Job #${args.job_id} not found.` };
        return {
          result: `Job #${args.job_id} ("${rows[0].title}") moved to stage: ${args.stage}.`,
          action: { resource: "jobs", id: args.job_id },
        };
      }

      case "set_job_priority": {
        const rows = await db
          .update(jobsTable)
          .set({ priority: args.priority, updatedAt: new Date() })
          .where(eq(jobsTable.id, args.job_id))
          .returning({ id: jobsTable.id, title: jobsTable.title });
        if (!rows.length) return { result: `Job #${args.job_id} not found.` };
        return {
          result: `Job #${args.job_id} ("${rows[0].title}") priority set to ${args.priority}.`,
          action: { resource: "jobs", id: args.job_id },
        };
      }

      case "add_job_notes": {
        const rows = await db
          .update(jobsTable)
          .set({ notes: args.notes, updatedAt: new Date() })
          .where(eq(jobsTable.id, args.job_id))
          .returning({ id: jobsTable.id, title: jobsTable.title });
        if (!rows.length) return { result: `Job #${args.job_id} not found.` };
        return {
          result: `Notes updated on Job #${args.job_id} ("${rows[0].title}").`,
          action: { resource: "jobs", id: args.job_id },
        };
      }

      case "set_enquiry_status": {
        const rows = await db
          .update(enquiriesTable)
          .set({ status: args.status, updatedAt: new Date() })
          .where(eq(enquiriesTable.id, args.enquiry_id))
          .returning({ id: enquiriesTable.id, title: enquiriesTable.title });
        if (!rows.length) return { result: `Enquiry #${args.enquiry_id} not found.` };
        return {
          result: `Enquiry #${args.enquiry_id} ("${rows[0].title}") status updated to: ${args.status}.`,
          action: { resource: "enquiries", id: args.enquiry_id },
        };
      }

      case "add_enquiry_notes": {
        const rows = await db
          .update(enquiriesTable)
          .set({ notes: args.notes, updatedAt: new Date() })
          .where(eq(enquiriesTable.id, args.enquiry_id))
          .returning({ id: enquiriesTable.id, title: enquiriesTable.title });
        if (!rows.length) return { result: `Enquiry #${args.enquiry_id} not found.` };
        return {
          result: `Notes updated on Enquiry #${args.enquiry_id} ("${rows[0].title}").`,
          action: { resource: "enquiries", id: args.enquiry_id },
        };
      }

      case "mark_inspection_ready": {
        const updates: Record<string, any> = {
          siteReadyToQuote: args.ready,
          updatedAt: new Date(),
        };
        if (args.notes) updates.notes = args.notes;
        const rows = await db
          .update(inspectionsTable)
          .set(updates)
          .where(eq(inspectionsTable.id, args.inspection_id))
          .returning({ id: inspectionsTable.id, farmName: inspectionsTable.farmName });
        if (!rows.length) return { result: `Inspection #${args.inspection_id} not found.` };
        const label = rows[0].farmName || `#${args.inspection_id}`;
        return {
          result: `Inspection "${label}" marked as ${args.ready ? "ready to quote" : "not ready to quote"}.`,
          action: { resource: "inspections", id: args.inspection_id },
        };
      }

      case "add_inspection_notes": {
        const rows = await db
          .update(inspectionsTable)
          .set({ notes: args.notes, updatedAt: new Date() })
          .where(eq(inspectionsTable.id, args.inspection_id))
          .returning({ id: inspectionsTable.id, farmName: inspectionsTable.farmName });
        if (!rows.length) return { result: `Inspection #${args.inspection_id} not found.` };
        return {
          result: `Notes updated on Inspection #${rows[0].farmName || args.inspection_id}.`,
          action: { resource: "inspections", id: args.inspection_id },
        };
      }

      case "get_record": {
        const { record_type, id } = args;
        let row: any = null;
        if (record_type === "job") {
          const rows = await db.select().from(jobsTable).where(eq(jobsTable.id, id));
          row = rows[0];
        } else if (record_type === "inspection") {
          const rows = await db.select().from(inspectionsTable).where(eq(inspectionsTable.id, id));
          row = rows[0];
        } else if (record_type === "enquiry") {
          const rows = await db.select().from(enquiriesTable).where(eq(enquiriesTable.id, id));
          row = rows[0];
        } else if (record_type === "customer") {
          const rows = await db.select().from(customersTable).where(eq(customersTable.id, id));
          row = rows[0];
        }
        if (!row) return { result: `${record_type} #${id} not found.` };
        return { result: JSON.stringify(row, null, 2) };
      }

      case "list_records": {
        const { record_type, filter } = args;
        let rows: any[] = [];

        if (record_type === "jobs") {
          const query = db.select().from(jobsTable).orderBy(desc(jobsTable.updatedAt));
          rows = filter
            ? (await query).filter((j) => j.stage === filter)
            : await query;
          rows = rows.map((j) => ({ id: j.id, title: j.title, stage: j.stage, priority: j.priority, updatedAt: j.updatedAt }));
        } else if (record_type === "enquiries") {
          const query = db.select().from(enquiriesTable).orderBy(desc(enquiriesTable.updatedAt));
          rows = filter
            ? (await query).filter((e) => e.status === filter)
            : await query;
          rows = rows.map((e) => ({ id: e.id, title: e.title, status: e.status, priority: e.priority, createdAt: e.createdAt }));
        } else if (record_type === "inspections") {
          const allInspections = await db.select().from(inspectionsTable).orderBy(desc(inspectionsTable.updatedAt));
          if (filter === "ready") {
            rows = allInspections.filter((i) => i.siteReadyToQuote);
          } else if (filter === "unconverted") {
            const allJobs = await db.select({ iid: jobsTable.inspectionId }).from(jobsTable);
            const convertedIds = new Set(allJobs.filter((j) => j.iid).map((j) => j.iid));
            rows = allInspections.filter((i) => !convertedIds.has(i.id));
          } else {
            rows = allInspections;
          }
          rows = rows.map((i) => ({ id: i.id, farmName: i.farmName, nearestTown: i.nearestTown, siteReadyToQuote: i.siteReadyToQuote, createdAt: i.createdAt }));
        } else if (record_type === "customers") {
          const all = await db.select().from(customersTable).orderBy(desc(customersTable.createdAt));
          rows = all.map((c) => ({ id: c.id, name: c.name, email: c.email, phone: c.phone }));
        }

        if (!rows.length) return { result: `No ${record_type} found${filter ? ` matching filter: ${filter}` : ""}.` };
        return { result: JSON.stringify(rows, null, 2) };
      }

      default:
        return { result: `Unknown tool: ${name}` };
    }
  } catch (err: any) {
    return { result: `Error executing ${name}: ${err.message}` };
  }
}

function getThinkingMessage(name: string, args: Record<string, any>): string {
  switch (name) {
    case "close_job": return `Closing Job #${args.job_id} as ${args.outcome}...`;
    case "set_job_stage": return `Moving Job #${args.job_id} to ${args.stage}...`;
    case "set_job_priority": return `Updating priority for Job #${args.job_id}...`;
    case "add_job_notes": return `Saving notes on Job #${args.job_id}...`;
    case "set_enquiry_status": return `Updating Enquiry #${args.enquiry_id} status...`;
    case "add_enquiry_notes": return `Saving notes on Enquiry #${args.enquiry_id}...`;
    case "mark_inspection_ready": return `Updating Inspection #${args.inspection_id}...`;
    case "add_inspection_notes": return `Saving notes on Inspection #${args.inspection_id}...`;
    case "get_record": return `Fetching ${args.record_type} #${args.id}...`;
    case "list_records": return `Loading ${args.filter ? args.filter + " " : ""}${args.record_type}...`;
    default: return `Working on it...`;
  }
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function daysDiff(date: Date | string): number {
  return Math.floor((Date.now() - new Date(date).getTime()) / (1000 * 60 * 60 * 24));
}

function buildAdminContextBlock(
  systemSnapshot: Record<string, unknown> | undefined,
  currentPage: string | undefined,
  contextType: string | undefined,
  contextData: Record<string, unknown> | undefined,
  userName: string | undefined
): string {
  const parts: string[] = [];

  // Identity
  const name = userName || "the administrator";
  parts.push(`\nYou are speaking with ${name}, the Firesky system administrator. You have full live access to the database and can read and write any record using your tools.`);

  // Current page
  if (currentPage) {
    parts.push(`\nThe admin is currently viewing: ${currentPage}`);
    if (currentPage.includes("/jobs/")) {
      const id = currentPage.match(/\/jobs\/(\d+)/)?.[1];
      if (id) parts.push(`Call get_record("job", ${id}) to get the full details of this job if needed.`);
    } else if (currentPage.includes("/inspections/")) {
      const id = currentPage.match(/\/inspections\/(\d+)/)?.[1];
      if (id) parts.push(`Call get_record("inspection", ${id}) to get the full details of this inspection if needed.`);
    } else if (currentPage.includes("/enquiries/")) {
      const id = currentPage.match(/\/enquiries\/(\d+)/)?.[1];
      if (id) parts.push(`Call get_record("enquiry", ${id}) to get the full details of this enquiry if needed.`);
    } else if (currentPage.includes("/customers/")) {
      const id = currentPage.match(/\/customers\/(\d+)/)?.[1];
      if (id) parts.push(`Call get_record("customer", ${id}) to get the full details of this customer if needed.`);
    }
  }

  // Inline context (from "Ask Sky" button clicks)
  if (contextData && Object.keys(contextData).length > 0 && contextType && contextType !== "general") {
    const label: Record<string, string> = {
      customer: "CUSTOMER RECORD",
      enquiry: "ENQUIRY RECORD",
      inspection: "SITE INSPECTION RECORD",
      job: "JOB RECORD",
      dashboard: "DASHBOARD SUMMARY",
    };
    const title = label[contextType] || "RECORD";
    const lines = Object.entries(contextData)
      .filter(([, v]) => v !== null && v !== undefined && v !== "")
      .map(([k, v]) => {
        const key = k.replace(/([A-Z])/g, " $1").replace(/^./, (s) => s.toUpperCase());
        return `  ${key}: ${typeof v === "object" ? JSON.stringify(v) : v}`;
      });
    if (lines.length > 0) {
      parts.push(`\n\n--- ${title} ---\n${lines.join("\n")}\n---`);
    }
  }

  // System snapshot
  if (systemSnapshot) {
    try {
      const s = systemSnapshot as any;
      const now = new Date().toLocaleString("en-ZA", { dateStyle: "medium", timeStyle: "short" });
      const snap: string[] = [`\n\n--- LIVE SYSTEM SNAPSHOT (${now}) ---`];

      snap.push(`\nBusiness overview:`);
      snap.push(`  Customers: ${s.customers?.total ?? 0} total, ${s.customers?.newInLast30Days ?? 0} added in last 30 days`);
      snap.push(`  Enquiries: ${s.enquiries?.total ?? 0} total`);
      snap.push(`  Jobs: ${s.jobs?.total ?? 0} total`);
      snap.push(`  Inspections: ${s.inspections?.total ?? 0} total`);

      const byStatus = s.enquiries?.byStatus || {};
      if (Object.keys(byStatus).length > 0) {
        snap.push(`\nEnquiries by status:`);
        for (const [status, count] of Object.entries(byStatus)) {
          snap.push(`  - ${status}: ${count}`);
        }
      }

      const byStage = s.jobs?.byStage || {};
      if (Object.keys(byStage).length > 0) {
        snap.push(`\nJobs by stage:`);
        for (const stage of ["enquiry", "inspection", "quoting", "quoted", "won", "lost", "closed"]) {
          if (byStage[stage]) snap.push(`  - ${stage}: ${byStage[stage]}`);
        }
      }

      const stalled = (s.jobs?.stalledJobs || []) as any[];
      if (stalled.length > 0) {
        snap.push(`\nStalled jobs needing follow-up:`);
        for (const j of stalled) {
          snap.push(`  - Job #${j.id}: "${j.title}" — ${j.daysSinceUpdate} days in ${j.stage}`);
        }
      }

      const newEnq = (s.enquiries?.newPendingResponse || []) as any[];
      if (newEnq.length > 0) {
        snap.push(`\nNew enquiries awaiting response:`);
        for (const e of newEnq) {
          snap.push(`  - Enquiry #${e.id}: "${e.title}" — ${e.daysOld} day${e.daysOld !== 1 ? "s" : ""} old`);
        }
      }

      const readyToQuote = (s.inspections?.readyToQuote || []) as any[];
      if (readyToQuote.length > 0) {
        snap.push(`\nInspections ready to convert to jobs:`);
        for (const i of readyToQuote) {
          const loc = [i.farmName, i.nearestTown].filter(Boolean).join(", ");
          snap.push(`  - Inspection #${i.id}${loc ? `: ${loc}` : ""}`);
        }
      }

      const unconverted = s.inspections?.notYetConvertedToJob ?? 0;
      if (unconverted > 0) snap.push(`\nInspections not yet converted to a job: ${unconverted}`);

      snap.push(`\n---`);
      parts.push(snap.join("\n"));
    } catch {
      // ignore
    }
  }

  return parts.join("\n");
}

function buildFieldContextBlock(
  contextType: string | undefined,
  contextData: Record<string, unknown> | undefined,
  userName: string | undefined
): string {
  const parts: string[] = [];
  const name = userName || "a field team member";
  parts.push(`\nYou are assisting ${name}, a Firesky field team member.`);

  if (contextData && Object.keys(contextData).length > 0 && contextType && contextType !== "general") {
    const label: Record<string, string> = {
      customer: "CUSTOMER RECORD",
      enquiry: "ENQUIRY RECORD",
      inspection: "SITE INSPECTION RECORD",
      job: "JOB RECORD",
    };
    const title = label[contextType] || "RECORD";
    const lines = Object.entries(contextData)
      .filter(([, v]) => v !== null && v !== undefined && v !== "")
      .map(([k, v]) => {
        const key = k.replace(/([A-Z])/g, " $1").replace(/^./, (s) => s.toUpperCase());
        return `  ${key}: ${typeof v === "object" ? JSON.stringify(v) : v}`;
      });
    if (lines.length > 0) {
      parts.push(`\n\n--- ${title} ---\n${lines.join("\n")}\n---`);
    }
  }

  return parts.join("\n");
}

// ─── GET /sky/context — admin only system snapshot ───────────────────────────

router.get("/sky/context", requireAdmin, async (_req, res): Promise<void> => {
  try {
    const now = Date.now();
    const thirtyDaysAgo = new Date(now - 30 * 24 * 60 * 60 * 1000);

    const [customers, enquiries, jobs, inspections] = await Promise.all([
      db.select({ id: customersTable.id, createdAt: customersTable.createdAt }).from(customersTable),
      db.select({
        id: enquiriesTable.id,
        title: enquiriesTable.title,
        status: enquiriesTable.status,
        createdAt: enquiriesTable.createdAt,
      }).from(enquiriesTable).orderBy(desc(enquiriesTable.createdAt)),
      db.select({
        id: jobsTable.id,
        title: jobsTable.title,
        stage: jobsTable.stage,
        priority: jobsTable.priority,
        inspectionId: jobsTable.inspectionId,
        updatedAt: jobsTable.updatedAt,
        createdAt: jobsTable.createdAt,
      }).from(jobsTable).orderBy(desc(jobsTable.updatedAt)),
      db.select({
        id: inspectionsTable.id,
        farmName: inspectionsTable.farmName,
        nearestTown: inspectionsTable.nearestTown,
        siteReadyToQuote: inspectionsTable.siteReadyToQuote,
        createdAt: inspectionsTable.createdAt,
      }).from(inspectionsTable),
    ]);

    const enquiriesByStatus: Record<string, number> = {};
    for (const e of enquiries) {
      enquiriesByStatus[e.status] = (enquiriesByStatus[e.status] ?? 0) + 1;
    }

    const newPendingResponse = enquiries
      .filter((e) => e.status === "new")
      .slice(0, 10)
      .map((e) => ({ id: e.id, title: e.title, daysOld: daysDiff(e.createdAt) }));

    const jobsByStage: Record<string, number> = {};
    for (const j of jobs) {
      jobsByStage[j.stage] = (jobsByStage[j.stage] ?? 0) + 1;
    }

    const stalledJobs = jobs
      .filter((j) => {
        if (j.stage === "quoting") return daysDiff(j.updatedAt) >= 7;
        if (j.stage === "quoted") return daysDiff(j.updatedAt) >= 14;
        return false;
      })
      .map((j) => ({
        id: j.id,
        title: j.title,
        stage: j.stage,
        priority: j.priority,
        daysSinceUpdate: daysDiff(j.updatedAt),
      }));

    const jobInspectionIds = new Set(jobs.filter((j) => j.inspectionId).map((j) => j.inspectionId));
    const unconverted = inspections.filter((i) => !jobInspectionIds.has(i.id));
    const readyToQuote = unconverted
      .filter((i) => i.siteReadyToQuote)
      .map((i) => ({ id: i.id, farmName: i.farmName, nearestTown: i.nearestTown }));

    res.json({
      asOf: new Date().toISOString(),
      customers: {
        total: customers.length,
        newInLast30Days: customers.filter((c) => new Date(c.createdAt) > thirtyDaysAgo).length,
      },
      enquiries: { total: enquiries.length, byStatus: enquiriesByStatus, newPendingResponse },
      jobs: { total: jobs.length, byStage: jobsByStage, stalledJobs },
      inspections: {
        total: inspections.length,
        notYetConvertedToJob: unconverted.length,
        readyToQuote,
      },
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ─── POST /sky/chat ──────────────────────────────────────────────────────────

type SkyChatMessage = { role: "user" | "assistant"; content: string };

router.post("/sky/chat", async (req, res) => {
  const {
    message,
    contextType,
    contextData,
    history,
    userName,
    userRole,
    systemSnapshot,
    currentPage,
  } = req.body as {
    message: string;
    contextType?: string;
    contextData?: Record<string, unknown>;
    history?: SkyChatMessage[];
    userName?: string;
    userRole?: string;
    systemSnapshot?: Record<string, unknown>;
    currentPage?: string;
  };

  if (!message || typeof message !== "string") {
    res.status(400).json({ error: "message is required" });
    return;
  }

  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");

  const sseWrite = (data: object) => res.write(`data: ${JSON.stringify(data)}\n\n`);

  try {
    const isAdmin = userRole === "admin";

    const systemSuffix = isAdmin
      ? buildAdminContextBlock(systemSnapshot, currentPage, contextType, contextData, userName)
      : buildFieldContextBlock(contextType, contextData, userName);

    const systemContent = FIRESKY_SYSTEM_PROMPT + systemSuffix;

    const chatMessages: any[] = [{ role: "system", content: systemContent }];

    if (Array.isArray(history)) {
      for (const msg of history) {
        if (msg.role === "user" || msg.role === "assistant") {
          chatMessages.push({ role: msg.role, content: msg.content });
        }
      }
    }
    chatMessages.push({ role: "user", content: message });

    if (isAdmin) {
      // ── Admin: tool-calling agent loop ──────────────────────────────────
      const MAX_ROUNDS = 6;

      for (let round = 0; round < MAX_ROUNDS; round++) {
        let completion: any;
        try {
          completion = await (openai.chat.completions.create as any)({
            model: "gpt-5.2",
            max_completion_tokens: 8192,
            messages: chatMessages,
            tools: ADMIN_TOOLS,
            tool_choice: "auto",
          });
        } catch (toolErr: any) {
          // If tools not supported, fall through to plain streaming
          console.warn("Tool calling failed, falling back to streaming:", toolErr.message);
          const fallback = await openai.chat.completions.create({
            model: "gpt-5.2",
            max_completion_tokens: 8192,
            messages: chatMessages,
            stream: true,
          });
          for await (const chunk of fallback) {
            const c = chunk.choices[0]?.delta?.content;
            if (c) sseWrite({ content: c });
          }
          break;
        }

        const choice = completion.choices[0];
        const msg = choice.message;
        chatMessages.push(msg);

        const finishReason = choice.finish_reason;
        const toolCalls = msg.tool_calls;

        if (finishReason === "stop" || !toolCalls || toolCalls.length === 0) {
          // Final response
          if (msg.content) sseWrite({ content: msg.content });
          break;
        }

        // Execute tool calls
        for (const tc of toolCalls) {
          const funcName = tc.function.name;
          let args: Record<string, any> = {};
          try { args = JSON.parse(tc.function.arguments || "{}"); } catch { /* ignore */ }

          sseWrite({ thinking: getThinkingMessage(funcName, args) });

          const { result, action } = await executeTool(funcName, args);

          if (action) {
            sseWrite({ action });
          }

          chatMessages.push({
            role: "tool",
            tool_call_id: tc.id,
            content: result,
          });
        }
      }
    } else {
      // ── Non-admin: plain streaming ────────────────────────────────────────
      const stream = await openai.chat.completions.create({
        model: "gpt-5.2",
        max_completion_tokens: 8192,
        messages: chatMessages,
        stream: true,
      });

      for await (const chunk of stream) {
        const content = chunk.choices[0]?.delta?.content;
        if (content) sseWrite({ content });
      }
    }

    sseWrite({ done: true });
    res.end();
  } catch (err: any) {
    console.error("Sky chat error:", err);
    sseWrite({ error: "Sky is unavailable right now. Please try again." });
    sseWrite({ done: true });
    res.end();
  }
});

export default router;
