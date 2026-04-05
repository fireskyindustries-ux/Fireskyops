import { Router } from "express";
import { desc } from "drizzle-orm";
import { openai } from "@workspace/integrations-openai-ai-server";
import { db, customersTable, enquiriesTable, jobsTable, inspectionsTable } from "@workspace/db";
import { requireAdmin } from "../middlewares/requireAuth";

const router = Router();

const FIRESKY_SYSTEM_PROMPT = `You are Sky, the built-in AI assistant and operational brain for Firesky Industries. You are warm, knowledgeable, and genuinely happy to help. Every person you speak with is a valued member of the Firesky team, and you treat them that way with a friendly, welcoming tone in every reply.

Firesky Industries installs water tanks at farms and remote rural properties across South Africa. Your role is to assist the field team and management with practical, grounded guidance while making every interaction feel effortless and supported.

Tank naming rule: Always refer to water tanks as "our tanks". You may mention sizes and capacities freely (for example, 2,500 litre, 5,000 litre, 10,000 litre). Never mention any tank brand, manufacturer, or trade name. Firesky supplies its own tanks and they are always called "our tanks".

Your areas of expertise:
- Tank sizing and capacity recommendations for agricultural and rural use
- Stand vs plinth decisions: use a steel stand when the tank needs to be elevated for gravity-fed pressure, and a concrete plinth when the tank sits on uneven ground, needs added stability, or is at ground level
- Site inspection completeness: flag missing measurements, missing access information, or unconfirmed readiness
- Pipe lengths and distances: check that inlet, outlet, and overflow runs are specified and make sense
- Delivery and access risk: flag difficult road access, low overhead clearances, soft ground, and seasonal road conditions
- Quote readiness: determine whether an inspection has enough captured data to generate a quotation
- Generating a structured quote summary from inspection data
- Business pipeline analysis: identifying stalled jobs, overdue follow-ups, and prioritisation

Tone and style:
- Be warm, friendly, and welcoming. Greet people by name when you know it. Make them feel supported and confident.
- Be clear and practical. The team is often reading on a phone in the field, so keep responses focused and well organised.
- Use proper grammar at all times. Write in full sentences with correct punctuation, commas, full stops, and capital letters where needed.
- Do not use markdown formatting symbols such as ** or ## in your replies. Do not bold or italicise text using symbols.
- When listing items, use a simple dash at the start of each point, followed by a space. Each point should be on its own line.
- Group related information under clear plain-text headings, followed by a colon, when a response covers more than one topic.
- Never use emoji.
- Avoid vague advice. When something is missing from a record, say exactly what is missing. When a site is ready to quote, say so clearly.

If no record context is provided, you can still answer general Firesky field questions and offer helpful guidance.`;

type SkyChatMessage = {
  role: "user" | "assistant";
  content: string;
};

function daysDiff(date: Date | string): number {
  return Math.floor((Date.now() - new Date(date).getTime()) / (1000 * 60 * 60 * 24));
}

function buildContextBlock(contextType: string | undefined, contextData: Record<string, unknown> | undefined): string {
  if (!contextType || !contextData || Object.keys(contextData).length === 0) return "";
  const label: Record<string, string> = {
    customer: "CURRENT CUSTOMER RECORD",
    enquiry: "CURRENT ENQUIRY RECORD",
    inspection: "CURRENT SITE INSPECTION RECORD",
    job: "CURRENT JOB RECORD",
    dashboard: "CURRENT DASHBOARD SUMMARY",
    general: "CURRENT CONTEXT",
  };
  const title = label[contextType] || "CURRENT RECORD";
  const lines = Object.entries(contextData)
    .filter(([, v]) => v !== null && v !== undefined && v !== "")
    .map(([k, v]) => {
      const key = k.replace(/([A-Z])/g, " $1").replace(/^./, (s) => s.toUpperCase());
      return `  ${key}: ${typeof v === "object" ? JSON.stringify(v) : v}`;
    });
  if (lines.length === 0) return "";
  return `\n\n--- ${title} ---\n${lines.join("\n")}\n---`;
}

function buildRoleBlock(userRole: string | undefined, userName: string | undefined): string {
  if (userRole === "admin") {
    const name = userName || "the administrator";
    return `\n\nYou are currently speaking with ${name}, the system administrator for Firesky Industries. They have full access to all customers, enquiries, site inspections, jobs, and team management. You have live access to the current state of the entire Firesky business system — use that data actively to provide meaningful, specific insights. Identify stalled jobs by name, flag overdue follow-ups, recommend priority actions. Provide thorough, business-level intelligence. You maintain a persistent conversation history with this administrator across sessions. Build on what has been discussed before. Address them by name.`;
  }
  if (userRole === "user") {
    const name = userName || "a field team member";
    return `\n\nYou are currently assisting ${name}, a field team member. Address them by name when appropriate.`;
  }
  if (userName) {
    return `\n\nYou are currently assisting ${userName}. Address them by name when appropriate.`;
  }
  return "";
}

function buildSystemSnapshotBlock(snapshot: Record<string, unknown> | undefined): string {
  if (!snapshot) return "";
  try {
    const s = snapshot as any;
    const now = new Date().toLocaleString("en-ZA", { dateStyle: "medium", timeStyle: "short" });
    const lines: string[] = [`\n\n--- LIVE FIRESKY SYSTEM SNAPSHOT (as of ${now}) ---`];

    // Business overview
    lines.push("\nBusiness Overview:");
    lines.push(`  Customers: ${s.customers?.total ?? 0} total, ${s.customers?.newInLast30Days ?? 0} added in the last 30 days`);
    lines.push(`  Enquiries: ${s.enquiries?.total ?? 0} total`);
    lines.push(`  Jobs: ${s.jobs?.total ?? 0} total`);
    lines.push(`  Inspections: ${s.inspections?.total ?? 0} total`);

    // Enquiries by status
    const byStatus = s.enquiries?.byStatus || {};
    lines.push("\nEnquiries by Status:");
    if (byStatus.new) lines.push(`  - New (awaiting action): ${byStatus.new}`);
    if (byStatus.in_progress) lines.push(`  - In Progress: ${byStatus.in_progress}`);
    if (byStatus.closed) lines.push(`  - Closed: ${byStatus.closed}`);

    // Jobs by stage
    const byStage = s.jobs?.byStage || {};
    lines.push("\nJobs Pipeline:");
    const stageOrder = ["enquiry", "inspection", "quoting", "quoted", "won", "lost", "closed"];
    for (const stage of stageOrder) {
      if (byStage[stage]) lines.push(`  - ${stage.charAt(0).toUpperCase() + stage.slice(1)}: ${byStage[stage]}`);
    }

    // Stalled jobs
    const stalled = (s.jobs?.stalledJobs || []) as any[];
    if (stalled.length > 0) {
      lines.push("\nJobs Needing Urgent Follow-Up:");
      for (const j of stalled) {
        const action = j.stage === "quoted" ? "chase customer for decision" : "generate quote";
        lines.push(`  - Job #${j.id}: "${j.title}" — ${j.daysSinceUpdate} days in ${j.stage}, ${action}`);
      }
    }

    // New enquiries pending response
    const newEnq = (s.enquiries?.newPendingResponse || []) as any[];
    if (newEnq.length > 0) {
      lines.push("\nNew Enquiries Awaiting Response:");
      for (const e of newEnq) {
        lines.push(`  - Enquiry #${e.id}: "${e.title}" — ${e.daysOld} day${e.daysOld !== 1 ? "s" : ""} old`);
      }
    }

    // Inspections ready to quote but not yet converted
    const readyToQuote = (s.inspections?.readyToQuote || []) as any[];
    if (readyToQuote.length > 0) {
      lines.push("\nInspections Ready to Convert to Jobs:");
      for (const i of readyToQuote) {
        const loc = [i.farmName, i.nearestTown].filter(Boolean).join(", ");
        lines.push(`  - Inspection #${i.id}${loc ? `: ${loc}` : ""}`);
      }
    }

    const unconverted = s.inspections?.notYetConvertedToJob ?? 0;
    if (unconverted > 0) {
      lines.push(`\nInspections not yet converted to jobs: ${unconverted}`);
    }

    lines.push("\n---");
    return lines.join("\n");
  } catch {
    return "";
  }
}

// GET /sky/context — admin only, returns a live system snapshot for Sky
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

    // Enquiries by status
    const enquiriesByStatus: Record<string, number> = {};
    for (const e of enquiries) {
      const s = e.status || "unknown";
      enquiriesByStatus[s] = (enquiriesByStatus[s] ?? 0) + 1;
    }

    // New enquiries awaiting response
    const newPendingResponse = enquiries
      .filter((e) => e.status === "new")
      .slice(0, 8)
      .map((e) => ({ id: e.id, title: e.title, daysOld: daysDiff(e.createdAt) }));

    // Jobs by stage
    const jobsByStage: Record<string, number> = {};
    for (const j of jobs) {
      jobsByStage[j.stage] = (jobsByStage[j.stage] ?? 0) + 1;
    }

    // Stalled jobs: quoting 7+ days, quoted 14+ days
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

    // Inspections not yet converted to jobs
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
      enquiries: {
        total: enquiries.length,
        byStatus: enquiriesByStatus,
        newPendingResponse,
      },
      jobs: {
        total: jobs.length,
        byStage: jobsByStage,
        stalledJobs,
      },
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

// POST /sky/chat — streaming chat endpoint
router.post("/sky/chat", async (req, res) => {
  const { message, contextType, contextData, history, userName, userRole, systemSnapshot } = req.body as {
    message: string;
    contextType?: string;
    contextData?: Record<string, unknown>;
    history?: SkyChatMessage[];
    userName?: string;
    userRole?: string;
    systemSnapshot?: Record<string, unknown>;
  };

  if (!message || typeof message !== "string") {
    res.status(400).json({ error: "message is required" });
    return;
  }

  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");

  try {
    const roleBlock = buildRoleBlock(userRole, userName);
    const snapshotBlock = userRole === "admin" ? buildSystemSnapshotBlock(systemSnapshot) : "";
    const contextBlock = buildContextBlock(contextType, contextData);
    const systemContent = FIRESKY_SYSTEM_PROMPT + roleBlock + snapshotBlock + contextBlock;

    const chatMessages: { role: "system" | "user" | "assistant"; content: string }[] = [
      { role: "system", content: systemContent },
    ];

    if (Array.isArray(history)) {
      for (const msg of history) {
        if (msg.role === "user" || msg.role === "assistant") {
          chatMessages.push({ role: msg.role, content: msg.content });
        }
      }
    }

    chatMessages.push({ role: "user", content: message });

    const stream = await openai.chat.completions.create({
      model: "gpt-5.2",
      max_completion_tokens: 8192,
      messages: chatMessages,
      stream: true,
    });

    for await (const chunk of stream) {
      const content = chunk.choices[0]?.delta?.content;
      if (content) {
        res.write(`data: ${JSON.stringify({ content })}\n\n`);
      }
    }

    res.write(`data: ${JSON.stringify({ done: true })}\n\n`);
    res.end();
  } catch (err) {
    console.error("Sky chat error:", err);
    res.write(`data: ${JSON.stringify({ error: "Sky is unavailable right now. Please try again." })}\n\n`);
    res.write(`data: ${JSON.stringify({ done: true })}\n\n`);
    res.end();
  }
});

export default router;
