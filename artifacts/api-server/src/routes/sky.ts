import { Router } from "express";
import { eq, desc, ilike, and, notInArray, count } from "drizzle-orm";
import OpenAI from "openai";
import {
  db,
  customersTable,
  enquiriesTable,
  jobsTable,
  inspectionsTable,
  branchesTable,
  stockItemsTable,
  stockLevelsTable,
  stockMovementsTable,
} from "@workspace/db";
import { requireAdmin, requireAuth } from "../middlewares/requireAuth";
import { smartQuery } from "../lib/gemini-query";
import { brand } from "../brand.config";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
const GPT_MODEL = "gpt-5";

// Retry wrapper — handles transient 429 / 503 errors
async function withRetry<T>(fn: () => Promise<T>, maxRetries = 3): Promise<T> {
  let lastErr: unknown;
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (err: any) {
      lastErr = err;
      const status = err?.status ?? err?.error?.code;
      const isRetryable = status === 503 || status === 429;
      if (!isRetryable || attempt === maxRetries) throw err;
      const delay = (attempt + 1) * 2000;
      await new Promise((r) => setTimeout(r, delay));
    }
  }
  throw lastErr;
}

const router = Router();

// ─── System prompt ───────────────────────────────────────────────────────────

const FIRESKY_SYSTEM_PROMPT = `You are ${brand.ai.name}, ${brand.ai.description} — ${brand.ai.role}. You serve both the internal ${brand.name} team and their customers, and you always make people feel welcome and well looked after.

${brand.name} supplies and installs ${brand.industry.product} at ${brand.industry.serviceArea}, ${brand.industry.uniqueValue}.

Tank naming rules:
- Refer to tanks by their size only, for example: "the 5000L tank" or "a 2500L tank". Never say "our tank" or "our tanks".
- Never mention any tank brand, manufacturer, or trade name.
- Only explain tank materials (rotomoulded LLDPE) if a customer specifically asks what the tank is made of. When asked, you can explain that the tanks are manufactured using a rotational moulding process with linear low-density polyethylene (LLDPE), which makes them UV-resistant, durable, food-safe, and well suited to the South African climate. Do not volunteer this information unprompted.

Your character and values:
- You are warm, encouraging, and easy to talk to. Customers should feel like they are speaking to a knowledgeable friend, not a call centre.
- You are patient, respectful, and solution-focused.
- You reflect the ${brand.name} values: integrity, honest guidance, quality service, going the extra mile, and treating every person with genuine care.
- You focus on solving the person's real problem, not just making a sale.
- You ask clear, simple questions to understand what someone needs before recommending anything.
- You never guess at pricing, stock availability, delivery times, or technical specifications. If something needs confirming, say so honestly.
- You help people feel heard, supported, and confident about their next step.

Your areas of expertise:
- Tank sizing and capacity recommendations for residential, agricultural, and rural use
- Stand vs plinth decisions and when each is appropriate
- Site inspection completeness: flag missing measurements, access information, or unconfirmed readiness
- Pipe lengths and distances: check inlet, outlet, and overflow runs
- Delivery and access risk: flag difficult road access, low overhead clearances, soft ground
- Quote readiness: determine whether an inspection has enough captured data to generate a quotation
- Business pipeline analysis: identifying stalled jobs, overdue follow-ups, prioritisation

${brand.name} operates from multiple branches. The central branch is called ${brand.defaultBranchName} — this is the head office and primary stock warehouse managed by the super admin. All other branches receive their stock from ${brand.defaultBranchName}. Each branch has its own stock levels, customers, enquiries, and jobs. Branch admins manage their own branches. When asked about branch performance, stock levels, or which branch handles a region, use the list_branches or check_stock tools.

For admin users: You have live access to the entire ${brand.name} database and can take action. When an admin asks you to close a job, update a stage, change a status, add notes, or modify any record, use your available tools to do it directly — do not ask them to do it manually. After taking an action, confirm clearly what was done.

You can also answer questions about branches and stock, and take direct action on stock:
- list_branches: shows all branches with live stats
- check_stock: shows current stock levels at a branch
- list_stock_items: shows the global stock catalogue
- record_stock_movement: adds or removes stock, or sets an exact level (use 'in', 'out', or 'adjustment')
- create_stock_item: adds a new item to the global catalogue

When a stock request mentions a specific branch name or the context makes the branch obvious, proceed directly. When the branch is not clear, call list_branches immediately and present the available branches as a short numbered list so the user can simply reply with a number or name — never ask them to supply a branch ID. After the user picks a branch, call check_stock to show what is currently there, then make the update and confirm clearly what was done and the new level.

Tone and style:
- Warm, friendly, and welcoming. Greet people by name when you know it.
- Natural and human — easy for anyone to understand, whether they are a farmer in the field or a first-time customer.
- Keep replies short and to the point. Answer what was asked without padding or unnecessary detail.
- Clear and practical. The team is often on a phone in the field.
- Use proper grammar at all times with correct punctuation.
- Do not use markdown formatting symbols such as ** or ##.
- When listing items, use a simple dash and space at the start of each point on its own line.
- Group related information under plain-text headings followed by a colon.
- Never use emoji.`;

// ─── Guest / customer-facing system prompt ────────────────────────────────────

const GUEST_SYSTEM_PROMPT = `You are ${brand.ai.name}, the friendly product guide for ${brand.name}. You help customers understand their water storage needs and find the right solution for their home, farm, or property.

${brand.name} supplies and installs ${brand.industry.product} at ${brand.industry.serviceArea}, ${brand.industry.uniqueValue}.

Tank naming rules:
- Refer to tanks by their size only, for example: "the 5000L tank" or "a 2500L tank". Never say "our tank" or "our tanks".
- Never mention any tank brand, manufacturer, or trade name.
- Only explain tank materials (rotomoulded LLDPE) if a customer specifically asks what the tank is made of.

Your role is to:
- Help customers work out what size tank or pump they need
- Explain the difference between tank sizes and typical use cases
- Describe what a stand or plinth is and when each is used
- Help customers understand what the installation process involves
- Guide them to take the next step — submitting an enquiry so the ${brand.name} team can follow up with a proper quotation
- Answer general questions about water storage, rainwater harvesting, borehole tanks, chemical storage, and agricultural water supply

Common tank guidance:
- 500L to 1000L: Small households, supplementary storage, or backup water
- 2500L: Medium homes, small farms, or additional backup
- 5000L: Larger homes, small to medium farms, regular water security needs
- 10000L+: Large farms, agricultural operations, or properties with high water demand
- Always ask how many people live on the property, and whether the water is for drinking, livestock, irrigation, or all of the above before recommending a size
- Remind customers that they may need more than one tank and that multiple tanks can be linked together

What you do NOT do:
- Never share internal company information such as job records, pipeline data, stock levels, branch information, staff names, or customer account details
- Never quote specific prices — always direct them to submit an enquiry for a formal quotation
- Never confirm stock availability — direct them to submit an enquiry
- Do not discuss any internal operational matters

Encouraging next steps:
- When a customer seems ready, encourage them to submit an enquiry using the "New Enquiry" button so the ${brand.name} team can get in touch with a proper site assessment and quotation
- Keep the tone warm and encouraging — you want them to feel confident and looked after

Tone and style:
- Warm, patient, and welcoming — like speaking to a trusted advisor
- Easy to understand — avoid technical jargon unless the customer asks
- Encouraging without being pushy
- Use proper grammar and punctuation at all times
- Do not use markdown formatting symbols such as ** or ##
- When listing items, use a simple dash and space at the start of each point on its own line
- Never use emoji`;

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
  {
    type: "function" as const,
    function: {
      name: "create_customer",
      description: "Create a new customer record in the database.",
      parameters: {
        type: "object",
        properties: {
          name: { type: "string", description: "Full name or business name" },
          phone: { type: "string", description: "Phone number" },
          email: { type: "string", description: "Email address" },
          farmName: { type: "string", description: "Farm or property name" },
          nearestTown: { type: "string", description: "Nearest town or city" },
          province: { type: "string", description: "Province" },
          notes: { type: "string", description: "Any additional notes" },
        },
        required: ["name"],
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "update_customer",
      description: "Update fields on an existing customer record.",
      parameters: {
        type: "object",
        properties: {
          customer_id: { type: "integer" },
          name: { type: "string" },
          phone: { type: "string" },
          email: { type: "string" },
          farmName: { type: "string" },
          nearestTown: { type: "string" },
          province: { type: "string" },
          notes: { type: "string" },
          contactName: { type: "string" },
          accessNotes: { type: "string" },
        },
        required: ["customer_id"],
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "create_enquiry",
      description: "Create a new enquiry for an existing customer.",
      parameters: {
        type: "object",
        properties: {
          customerId: { type: "integer", description: "The customer ID to link this enquiry to" },
          title: { type: "string", description: "Short descriptive title" },
          description: { type: "string" },
          tankSize: { type: "string", description: "e.g. 10000L" },
          tankQuantity: { type: "integer" },
          priority: { type: "string", enum: ["low", "medium", "high"] },
          notes: { type: "string" },
        },
        required: ["customerId", "title"],
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "update_enquiry_full",
      description: "Update any field on an existing enquiry record — title, status, priority, description, tank size, or notes.",
      parameters: {
        type: "object",
        properties: {
          enquiry_id: { type: "integer" },
          title: { type: "string" },
          description: { type: "string" },
          status: { type: "string", enum: ["new", "in_progress", "inspection_done", "quoted", "won", "lost", "closed"] },
          priority: { type: "string", enum: ["low", "medium", "high"] },
          tankSize: { type: "string" },
          tankQuantity: { type: "integer" },
          notes: { type: "string" },
        },
        required: ["enquiry_id"],
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "create_job",
      description: "Create a new job record in the pipeline.",
      parameters: {
        type: "object",
        properties: {
          customerId: { type: "integer" },
          title: { type: "string" },
          stage: { type: "string", enum: ["enquiry", "inspection", "quoting", "quoted", "won", "lost", "closed"] },
          priority: { type: "string", enum: ["low", "medium", "high"] },
          enquiryId: { type: "integer" },
          inspectionId: { type: "integer" },
          tankSize: { type: "string" },
          tankQuantity: { type: "integer" },
          estimatedValue: { type: "number" },
          jobType: { type: "string", enum: ["full_install", "delivery_only"] },
          notes: { type: "string" },
        },
        required: ["customerId", "title"],
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "update_job_full",
      description: "Update any field on an existing job record — title, stage, priority, job type, tank details, value, or notes.",
      parameters: {
        type: "object",
        properties: {
          job_id: { type: "integer" },
          title: { type: "string" },
          stage: { type: "string", enum: ["enquiry", "inspection", "quoting", "quoted", "won", "lost", "closed"] },
          priority: { type: "string", enum: ["low", "medium", "high"] },
          jobType: { type: "string", enum: ["full_install", "delivery_only"] },
          tankSize: { type: "string" },
          tankQuantity: { type: "integer" },
          estimatedValue: { type: "number" },
          notes: { type: "string" },
        },
        required: ["job_id"],
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "update_inspection_full",
      description: "Update fields on a site inspection record — readiness, tank details, access, stand/plinth, or notes.",
      parameters: {
        type: "object",
        properties: {
          inspection_id: { type: "integer" },
          siteReadyToQuote: { type: "boolean" },
          tankSize: { type: "string" },
          tankQuantity: { type: "integer" },
          requiresStand: { type: "boolean" },
          requiresPlinth: { type: "boolean" },
          standHeight: { type: "string" },
          truckAccess: { type: "boolean" },
          trailerAccess: { type: "boolean" },
          groundCondition: { type: "string" },
          pipeLength: { type: "number" },
          offloadingConstraints: { type: "string" },
          notes: { type: "string" },
        },
        required: ["inspection_id"],
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "smart_query",
      description: `Ask a natural language question about the ${brand.name} database. Gemini translates it into a safe read-only SQL query and returns the live results. Use this when list_records or get_record cannot answer the question — for example: filtering by value, date ranges, cross-table analysis, totals, or any ad-hoc data question.`,
      parameters: {
        type: "object",
        properties: {
          question: {
            type: "string",
            description: "The data question in plain English, e.g. 'Which jobs have an estimated value over R50000?' or 'How many inspections were done this month?'",
          },
        },
        required: ["question"],
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "list_branches",
      description: `List all ${brand.name} branches with their live stats — active enquiry count, active job count, and customer count per branch. Use when asked about branches, locations, or how different branches are performing.`,
      parameters: { type: "object", properties: {} },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "check_stock",
      description: "Check the current stock levels for a specific branch. Returns all stock items and their current quantities at that branch.",
      parameters: {
        type: "object",
        properties: {
          branch_id: { type: "integer", description: "The ID of the branch to check stock for" },
        },
        required: ["branch_id"],
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "list_stock_items",
      description: "List all stock items in the global catalogue (names, units, categories). Use this before recording a movement when you need to confirm the item name or ID.",
      parameters: { type: "object", properties: {} },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "record_stock_movement",
      description: "Record a stock movement (add stock in, remove stock out, or set an adjusted quantity) for a specific item at a specific branch. Use the item name — it will be matched automatically. Type 'in' adds to quantity, 'out' removes, 'adjustment' sets the exact level.",
      parameters: {
        type: "object",
        properties: {
          branch_id: { type: "integer", description: "The branch ID where the movement occurs" },
          item_name: { type: "string", description: "Name of the stock item (will be matched by name)" },
          type: { type: "string", enum: ["in", "out", "adjustment"], description: "in = add stock, out = remove stock, adjustment = set exact quantity" },
          quantity: { type: "number", description: "The quantity to add, remove, or set" },
          note: { type: "string", description: "Optional note explaining the movement (e.g. 'Received from supplier', 'Used on Job #42')" },
        },
        required: ["branch_id", "item_name", "type", "quantity"],
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "create_stock_item",
      description: "Add a new item to the global stock catalogue. Once created, stock can be tracked for it at any branch.",
      parameters: {
        type: "object",
        properties: {
          name: { type: "string", description: "Item name, e.g. '5000L Tank'" },
          unit: { type: "string", description: "Unit of measurement, e.g. 'units', 'metres', 'kg'" },
          category: { type: "string", description: "Optional category, e.g. 'Tanks', 'Fittings', 'Pipes'" },
          description: { type: "string", description: "Optional description of the item" },
        },
        required: ["name", "unit"],
      },
    },
  },
] as const;

// ADMIN_TOOLS is already in OpenAI function-calling format — used directly.

// Branch admin gets stock tools only — branch_id is always injected server-side
const BRANCH_ADMIN_STOCK_TOOLS = [
  {
    type: "function" as const,
    function: {
      name: "check_stock",
      description: "Check the current stock levels at your branch. Returns all stock items and their quantities.",
      parameters: { type: "object", properties: {} },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "list_stock_items",
      description: "List all items in the stock catalogue (names, units, categories).",
      parameters: { type: "object", properties: {} },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "record_stock_movement",
      description: "Record a stock movement at your branch. Type 'in' adds stock, 'out' removes it, 'adjustment' sets the exact quantity. Match the item by name.",
      parameters: {
        type: "object",
        properties: {
          item_name: { type: "string", description: "Name of the stock item (matched automatically)" },
          type: { type: "string", enum: ["in", "out", "adjustment"], description: "in = add stock, out = remove stock, adjustment = set exact quantity" },
          quantity: { type: "number", description: "The quantity to add, remove, or set" },
          note: { type: "string", description: "Optional note explaining the movement (e.g. 'Received from supplier', 'Used on Job #42')" },
        },
        required: ["item_name", "type", "quantity"],
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "create_stock_item",
      description: "Add a new item to the global stock catalogue so it can be tracked at any branch.",
      parameters: {
        type: "object",
        properties: {
          name: { type: "string", description: "Item name, e.g. '5000L Tank'" },
          unit: { type: "string", description: "Unit of measurement, e.g. 'units', 'metres', 'kg'" },
          category: { type: "string", description: "Optional category, e.g. 'Tanks', 'Fittings', 'Pipes'" },
          description: { type: "string", description: "Optional description of the item" },
        },
        required: ["name", "unit"],
      },
    },
  },
];

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

      case "create_customer": {
        const { name, phone, email, farmName, nearestTown, province, notes } = args;
        const rows = await db.insert(customersTable).values({ name, phone, email, farmName, nearestTown, province, notes }).returning({ id: customersTable.id, name: customersTable.name });
        return {
          result: `Customer "${rows[0].name}" created with ID #${rows[0].id}.`,
          action: { resource: "customers", id: rows[0].id },
        };
      }

      case "update_customer": {
        const { customer_id, ...fields } = args;
        const updates: Record<string, any> = { updatedAt: new Date() };
        for (const key of ["name", "phone", "email", "farmName", "nearestTown", "province", "notes", "contactName", "accessNotes"]) {
          if (fields[key] !== undefined) updates[key] = fields[key];
        }
        const rows = await db.update(customersTable).set(updates).where(eq(customersTable.id, customer_id)).returning({ id: customersTable.id, name: customersTable.name });
        if (!rows.length) return { result: `Customer #${customer_id} not found.` };
        return {
          result: `Customer #${customer_id} ("${rows[0].name}") updated.`,
          action: { resource: "customers", id: customer_id },
        };
      }

      case "create_enquiry": {
        const { customerId, title, description, tankSize, tankQuantity, priority, notes } = args;
        const rows = await db.insert(enquiriesTable).values({ customerId, title, description, tankSize, tankQuantity: tankQuantity ? Number(tankQuantity) : undefined, priority: priority || "medium", notes }).returning({ id: enquiriesTable.id, title: enquiriesTable.title });
        return {
          result: `Enquiry "${rows[0].title}" created with ID #${rows[0].id}.`,
          action: { resource: "enquiries", id: rows[0].id },
        };
      }

      case "update_enquiry_full": {
        const { enquiry_id, ...fields } = args;
        const updates: Record<string, any> = { updatedAt: new Date() };
        for (const key of ["title", "description", "status", "priority", "tankSize", "notes"]) {
          if (fields[key] !== undefined) updates[key] = fields[key];
        }
        if (fields.tankQuantity !== undefined) updates.tankQuantity = Number(fields.tankQuantity);
        const rows = await db.update(enquiriesTable).set(updates).where(eq(enquiriesTable.id, enquiry_id)).returning({ id: enquiriesTable.id, title: enquiriesTable.title });
        if (!rows.length) return { result: `Enquiry #${enquiry_id} not found.` };
        return {
          result: `Enquiry #${enquiry_id} ("${rows[0].title}") updated.`,
          action: { resource: "enquiries", id: enquiry_id },
        };
      }

      case "create_job": {
        const { customerId, title, stage, priority, enquiryId, inspectionId, tankSize, tankQuantity, estimatedValue, jobType, notes } = args;
        const rows = await db.insert(jobsTable).values({
          customerId: Number(customerId),
          title,
          stage: stage || "enquiry",
          priority: priority || "medium",
          enquiryId: enquiryId ? Number(enquiryId) : undefined,
          inspectionId: inspectionId ? Number(inspectionId) : undefined,
          tankSize,
          tankQuantity: tankQuantity ? Number(tankQuantity) : undefined,
          estimatedValue: estimatedValue ? Number(estimatedValue) : undefined,
          jobType: jobType || "full_install",
          notes,
        }).returning({ id: jobsTable.id, title: jobsTable.title });
        return {
          result: `Job "${rows[0].title}" created with ID #${rows[0].id}.`,
          action: { resource: "jobs", id: rows[0].id },
        };
      }

      case "update_job_full": {
        const { job_id, ...fields } = args;
        const updates: Record<string, any> = { updatedAt: new Date() };
        for (const key of ["title", "stage", "priority", "jobType", "tankSize", "notes"]) {
          if (fields[key] !== undefined) updates[key] = fields[key];
        }
        if (fields.tankQuantity !== undefined) updates.tankQuantity = Number(fields.tankQuantity);
        if (fields.estimatedValue !== undefined) updates.estimatedValue = Number(fields.estimatedValue);
        const rows = await db.update(jobsTable).set(updates).where(eq(jobsTable.id, job_id)).returning({ id: jobsTable.id, title: jobsTable.title });
        if (!rows.length) return { result: `Job #${job_id} not found.` };
        return {
          result: `Job #${job_id} ("${rows[0].title}") updated.`,
          action: { resource: "jobs", id: job_id },
        };
      }

      case "update_inspection_full": {
        const { inspection_id, ...fields } = args;
        const updates: Record<string, any> = { updatedAt: new Date() };
        for (const key of ["siteReadyToQuote", "tankSize", "requiresStand", "requiresPlinth", "standHeight", "truckAccess", "trailerAccess", "groundCondition", "pipeLength", "offloadingConstraints", "notes"]) {
          if (fields[key] !== undefined) updates[key] = fields[key];
        }
        if (fields.tankQuantity !== undefined) updates.tankQuantity = Number(fields.tankQuantity);
        const rows = await db.update(inspectionsTable).set(updates).where(eq(inspectionsTable.id, inspection_id)).returning({ id: inspectionsTable.id, farmName: inspectionsTable.farmName });
        if (!rows.length) return { result: `Inspection #${inspection_id} not found.` };
        return {
          result: `Inspection #${inspection_id} (${rows[0].farmName || "unnamed"}) updated.`,
          action: { resource: "inspections", id: inspection_id },
        };
      }

      case "smart_query": {
        const result = await smartQuery(args.question);
        return { result };
      }

      case "list_branches": {
        const branches = await db.select().from(branchesTable);
        if (!branches.length) return { result: "No branches have been set up yet." };
        const [custCounts, enqCounts, jobCounts] = await Promise.all([
          db.select({ branchId: customersTable.branchId, c: count() }).from(customersTable).groupBy(customersTable.branchId),
          db.select({ branchId: enquiriesTable.branchId, c: count() }).from(enquiriesTable)
            .where(notInArray(enquiriesTable.status, ["won", "lost", "closed"]))
            .groupBy(enquiriesTable.branchId),
          db.select({ branchId: jobsTable.branchId, c: count() }).from(jobsTable)
            .where(notInArray(jobsTable.stage, ["won", "lost", "closed"]))
            .groupBy(jobsTable.branchId),
        ]);
        const cm = Object.fromEntries(custCounts.map((r) => [r.branchId ?? 0, Number(r.c)]));
        const em = Object.fromEntries(enqCounts.map((r) => [r.branchId ?? 0, Number(r.c)]));
        const jm = Object.fromEntries(jobCounts.map((r) => [r.branchId ?? 0, Number(r.c)]));
        const lines = branches.map((b) =>
          `Branch #${b.id} — ${b.name}${b.region ? ` (${b.region})` : ""}:\n` +
          `  Customers: ${cm[b.id] ?? 0}\n` +
          `  Active enquiries: ${em[b.id] ?? 0}\n` +
          `  Active jobs: ${jm[b.id] ?? 0}` +
          (b.phone ? `\n  Phone: ${b.phone}` : "") +
          (b.email ? `\n  Email: ${b.email}` : "")
        );
        return { result: lines.join("\n\n") };
      }

      case "check_stock": {
        const bid = Number(args.branch_id);
        const branch = await db.select().from(branchesTable).where(eq(branchesTable.id, bid));
        if (!branch.length) return { result: `Branch #${bid} not found.` };
        const levels = await db
          .select({
            itemName: stockItemsTable.name,
            itemUnit: stockItemsTable.unit,
            itemCategory: stockItemsTable.category,
            quantity: stockLevelsTable.quantity,
          })
          .from(stockLevelsTable)
          .innerJoin(stockItemsTable, eq(stockLevelsTable.stockItemId, stockItemsTable.id))
          .where(eq(stockLevelsTable.branchId, bid));
        if (!levels.length) return { result: `No stock recorded for ${branch[0].name} yet. Use list_stock_items to see the catalogue, then record_stock_movement to add stock.` };
        const lines = levels.map((l) =>
          `- ${l.itemName}: ${l.quantity} ${l.itemUnit}${l.itemCategory ? ` (${l.itemCategory})` : ""}`
        );
        return { result: `Stock levels at ${branch[0].name}:\n${lines.join("\n")}` };
      }

      case "list_stock_items": {
        const items = await db
          .select()
          .from(stockItemsTable)
          .orderBy(stockItemsTable.category, stockItemsTable.name);
        if (!items.length) return { result: "No stock items in the catalogue yet. Use create_stock_item to add items." };
        const lines = items.map((i) =>
          `- ID ${i.id}: ${i.name} (${i.unit})${i.category ? ` — ${i.category}` : ""}${i.description ? ` — ${i.description}` : ""}`
        );
        return { result: `Stock catalogue:\n${lines.join("\n")}` };
      }

      case "record_stock_movement": {
        const { branch_id, item_name, type, quantity, note } = args;
        const bid = Number(branch_id);
        const qty = Number(quantity);

        // Verify branch exists
        const [branch] = await db.select().from(branchesTable).where(eq(branchesTable.id, bid));
        if (!branch) return { result: `Branch #${bid} not found. Use list_branches to see available branches.` };

        // Resolve item by name (case-insensitive)
        const matches = await db
          .select()
          .from(stockItemsTable)
          .where(ilike(stockItemsTable.name, `%${item_name}%`));
        if (!matches.length) return { result: `No stock item matching "${item_name}" found. Use list_stock_items to see available items, or create_stock_item to add a new one.` };
        if (matches.length > 1) {
          const opts = matches.map((m) => `- ID ${m.id}: ${m.name}`).join("\n");
          return { result: `Multiple items match "${item_name}":\n${opts}\n\nPlease be more specific about which item you mean.` };
        }
        const item = matches[0];

        if (!["in", "out", "adjustment"].includes(type)) {
          return { result: `Invalid movement type "${type}". Use: in, out, or adjustment.` };
        }

        // Record movement
        await db.insert(stockMovementsTable).values({
          branchId: bid,
          stockItemId: item.id,
          type,
          quantity: qty,
          note: note || null,
          userId: null,
        });

        // Upsert stock level
        const existing = await db
          .select()
          .from(stockLevelsTable)
          .where(and(eq(stockLevelsTable.branchId, bid), eq(stockLevelsTable.stockItemId, item.id)));

        let newQty: number;
        if (existing.length > 0) {
          newQty = existing[0].quantity;
          if (type === "in") newQty += qty;
          else if (type === "out") newQty = Math.max(0, newQty - qty);
          else newQty = qty;
          await db
            .update(stockLevelsTable)
            .set({ quantity: newQty })
            .where(and(eq(stockLevelsTable.branchId, bid), eq(stockLevelsTable.stockItemId, item.id)));
        } else {
          newQty = type === "out" ? 0 : qty;
          await db.insert(stockLevelsTable).values({ branchId: bid, stockItemId: item.id, quantity: newQty });
        }

        const typeLabel = type === "in" ? "added to" : type === "out" ? "removed from" : "set to";
        return {
          result: `Done. ${qty} ${item.unit} of ${item.name} ${typeLabel} ${branch.name}. New stock level: ${newQty} ${item.unit}.${note ? ` Note: "${note}".` : ""}`,
          action: { resource: "stock", id: bid },
        };
      }

      case "create_stock_item": {
        const { name, unit, category, description } = args;
        // Check for duplicate
        const existing = await db.select().from(stockItemsTable).where(ilike(stockItemsTable.name, name));
        if (existing.length > 0) {
          return { result: `A stock item named "${existing[0].name}" already exists (ID ${existing[0].id}). Use record_stock_movement to update stock levels for it.` };
        }
        const [created] = await db
          .insert(stockItemsTable)
          .values({ name, unit: unit || "units", category: category || null, description: description || null })
          .returning();
        return {
          result: `Stock item created: "${created.name}" (ID ${created.id}, unit: ${created.unit}${created.category ? `, category: ${created.category}` : ""}). You can now use record_stock_movement to add stock for it at any branch.`,
          action: { resource: "stock", id: created.id },
        };
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
    case "create_customer": return `Creating customer "${args.name}"...`;
    case "update_customer": return `Updating Customer #${args.customer_id}...`;
    case "create_enquiry": return `Creating enquiry "${args.title}"...`;
    case "update_enquiry_full": return `Updating Enquiry #${args.enquiry_id}...`;
    case "create_job": return `Creating job "${args.title}"...`;
    case "update_job_full": return `Updating Job #${args.job_id}...`;
    case "update_inspection_full": return `Updating Inspection #${args.inspection_id}...`;
    case "smart_query": return `Querying the database...`;
    case "list_branches": return `Loading branch overview...`;
    case "check_stock": return `Checking stock levels for Branch #${args.branch_id}...`;
    case "list_stock_items": return `Loading stock catalogue...`;
    case "record_stock_movement": return `Recording ${args.type} of ${args.quantity} × ${args.item_name} at Branch #${args.branch_id}...`;
    case "create_stock_item": return `Creating stock item "${args.name}"...`;
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
  parts.push(`\nYou are speaking with ${name}, the ${brand.name} system administrator. You have full live access to the database and can read and write any record using your tools.`);

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

      // Branch overview from snapshot if available
      const branchBreakdown = (s.branchBreakdown || []) as any[];
      if (branchBreakdown.length > 0) {
        snap.push(`\nBranch overview:`);
        for (const b of branchBreakdown) {
          snap.push(`  - ${b.name}${b.region ? ` (${b.region})` : ""}: ${b.customers} customers, ${b.activeEnquiries} active enquiries, ${b.activeJobs} active jobs`);
        }
        snap.push(`  Use list_branches or check_stock tools for live branch/stock data.`);
      }

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
  parts.push(`\nYou are assisting ${name}, a ${brand.name} field team member.`);

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

function buildMessages(
  systemInstruction: string,
  history: SkyChatMessage[] | undefined,
  message: string,
): any[] {
  const messages: any[] = [{ role: "system", content: systemInstruction }];
  if (Array.isArray(history)) {
    for (const msg of history) {
      if (msg.role === "user" || msg.role === "assistant") {
        messages.push({ role: msg.role, content: msg.content });
      }
    }
  }
  messages.push({ role: "user", content: message });
  return messages;
}

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

  // Always use the server-verified role — never trust the client-supplied userRole
  const verifiedRole = (req as any).userRole as string | undefined ?? "guest";

  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");

  const sseWrite = (data: object) => res.write(`data: ${JSON.stringify(data)}\n\n`);

  try {
    const isAdmin = verifiedRole === "admin";
    const isGuest = verifiedRole === "guest";
    const verifiedBranchId = (req as any).userBranchId as number | null;
    const isBranchAdmin = verifiedRole === "branch_admin";

    const systemInstruction = isGuest
      ? GUEST_SYSTEM_PROMPT + (userName ? `\n\nThe customer's name is ${userName}. Greet them warmly by name.` : "")
      : FIRESKY_SYSTEM_PROMPT + (isAdmin
          ? buildAdminContextBlock(systemSnapshot, currentPage, contextType, contextData, userName)
          : isBranchAdmin
          ? `\n\nBRANCH ADMIN CONTEXT:\nYou are assisting ${userName ? userName + ", a" : "a"} branch admin. Their branch ID is ${verifiedBranchId ?? "unknown"}. All stock tool calls are automatically applied to their branch — you never need to ask which branch or specify a branch ID, it is always pre-filled.\n\nYou have access to the following stock tools for your branch:\n- check_stock: see current stock levels at your branch\n- list_stock_items: see the full catalogue of items\n- record_stock_movement: add stock (in), remove stock (out), or set an exact level (adjustment)\n- create_stock_item: add a new item to the catalogue\n\nWhen asked to check stock, update stock, or record a movement, use your tools directly — do not ask the user to do it manually. Always confirm what was done and show the updated quantity.`
          : buildFieldContextBlock(contextType, contextData, userName));

    const messages = buildMessages(systemInstruction, history, message);

    if (isGuest) {
      // ── Guest / customer: no tools, streaming ────────────────────────────
      const stream = await withRetry(() => openai.chat.completions.create({
        model: GPT_MODEL,
        messages,
        max_completion_tokens: 2048,
        stream: true,
      }));

      for await (const chunk of stream) {
        const text = chunk.choices[0]?.delta?.content ?? "";
        if (text) sseWrite({ content: text });
      }
    } else if (isAdmin) {
      // ── Admin: streaming tool-calling agent loop ─────────────────────────
      const MAX_ROUNDS = 6;

      for (let round = 0; round < MAX_ROUNDS; round++) {
        const stream = await withRetry(() => openai.chat.completions.create({
          model: GPT_MODEL,
          messages,
          tools: ADMIN_TOOLS as any,
          tool_choice: "auto",
          max_completion_tokens: 8192,
          stream: true,
        }));

        let assistantContent = "";
        const tcMap: Record<number, { id: string; name: string; args: string }> = {};
        let hasToolCalls = false;

        for await (const chunk of stream) {
          const delta = chunk.choices[0]?.delta;
          if (delta?.content) {
            assistantContent += delta.content;
            sseWrite({ content: delta.content });
          }
          if (delta?.tool_calls) {
            hasToolCalls = true;
            for (const tcd of delta.tool_calls) {
              const idx = tcd.index ?? 0;
              if (!tcMap[idx]) tcMap[idx] = { id: "", name: "", args: "" };
              if (tcd.id) tcMap[idx].id = tcd.id;
              if (tcd.function?.name) tcMap[idx].name += tcd.function.name;
              if (tcd.function?.arguments) tcMap[idx].args += tcd.function.arguments;
            }
          }
        }

        if (!hasToolCalls) break; // final content already streamed

        const assembledCalls = Object.values(tcMap).map((tc) => ({
          id: tc.id,
          type: "function" as const,
          function: { name: tc.name, arguments: tc.args },
        }));

        messages.push({
          role: "assistant",
          content: assistantContent || null,
          tool_calls: assembledCalls,
        } as any);

        for (const tc of assembledCalls) {
          const funcName = tc.function.name;
          const args = JSON.parse(tc.function.arguments || "{}") as Record<string, any>;
          sseWrite({ thinking: getThinkingMessage(funcName, args) });
          const { result, action } = await executeTool(funcName, args);
          if (action) sseWrite({ action });
          messages.push({ role: "tool", tool_call_id: tc.id, content: JSON.stringify(result) });
        }
      }
    } else if (isBranchAdmin) {
      // ── Branch admin: stock tool loop, branch ID auto-injected ───────────
      const branchAdminBranchId = verifiedBranchId;
      if (!branchAdminBranchId) {
        sseWrite({ content: "You do not have a branch assigned. Ask your system admin to assign you to a branch." });
      } else {
        const MAX_ROUNDS = 4;
        for (let round = 0; round < MAX_ROUNDS; round++) {
          const stream = await withRetry(() => openai.chat.completions.create({
            model: GPT_MODEL,
            messages,
            tools: BRANCH_ADMIN_STOCK_TOOLS as any,
            tool_choice: "auto",
            max_completion_tokens: 4096,
            stream: true,
          }));

          let assistantContent = "";
          const tcMap: Record<number, { id: string; name: string; args: string }> = {};
          let hasToolCalls = false;

          for await (const chunk of stream) {
            const delta = chunk.choices[0]?.delta;
            if (delta?.content) {
              assistantContent += delta.content;
              sseWrite({ content: delta.content });
            }
            if (delta?.tool_calls) {
              hasToolCalls = true;
              for (const tcd of delta.tool_calls) {
                const idx = tcd.index ?? 0;
                if (!tcMap[idx]) tcMap[idx] = { id: "", name: "", args: "" };
                if (tcd.id) tcMap[idx].id = tcd.id;
                if (tcd.function?.name) tcMap[idx].name += tcd.function.name;
                if (tcd.function?.arguments) tcMap[idx].args += tcd.function.arguments;
              }
            }
          }

          if (!hasToolCalls) break;

          const assembledCalls = Object.values(tcMap).map((tc) => ({
            id: tc.id,
            type: "function" as const,
            function: { name: tc.name, arguments: tc.args },
          }));

          messages.push({
            role: "assistant",
            content: assistantContent || null,
            tool_calls: assembledCalls,
          } as any);

          for (const tc of assembledCalls) {
            const funcName = tc.function.name;
            // Inject the verified branch ID — Sky never needs to know or specify it
            const args = { ...JSON.parse(tc.function.arguments || "{}"), branch_id: branchAdminBranchId };
            sseWrite({ thinking: getThinkingMessage(funcName, args) });
            const { result, action } = await executeTool(funcName, args);
            if (action) sseWrite({ action });
            messages.push({ role: "tool", tool_call_id: tc.id, content: JSON.stringify(result) });
          }
        }
      }
    } else {
      // ── Field worker: plain streaming ─────────────────────────────────────
      const stream = await withRetry(() => openai.chat.completions.create({
        model: GPT_MODEL,
        messages,
        max_completion_tokens: 8192,
        stream: true,
      }));

      for await (const chunk of stream) {
        const text = chunk.choices[0]?.delta?.content ?? "";
        if (text) sseWrite({ content: text });
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

// ─── Vision endpoint ─────────────────────────────────────────────────────────

const VISION_SYSTEM_PROMPT = FIRESKY_SYSTEM_PROMPT + `

You are currently in Sky Vision mode. The user is sharing live camera images from the field with you. You have memory of everything observed so far in this session — reference earlier observations where relevant.

Keep your responses concise and spoken-word friendly. No bullet lists with dashes — use natural flowing sentences instead. Avoid all markdown formatting. Speak as if you are right there with the technician on site.`;

router.post("/sky/vision", requireAuth, async (req, res): Promise<void> => {
  const {
    imageBase64,
    mimeType = "image/jpeg",
    question,
    history = [],
  } = req.body as {
    imageBase64: string;
    mimeType?: string;
    question?: string;
    history?: Array<{ role: "user" | "assistant"; content: string }>;
  };

  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");

  const sseWrite = (data: Record<string, unknown>) => {
    res.write(`data: ${JSON.stringify(data)}\n\n`);
  };

  const userQuestion =
    question?.trim() ||
    `What do you see? Describe what you observe and flag anything relevant to a ${brand.name} site inspection or installation.`;

  // Build OpenAI messages with history
  const visionMessages: any[] = [{ role: "system", content: VISION_SYSTEM_PROMPT }];
  for (const turn of history) {
    visionMessages.push({ role: turn.role === "assistant" ? "assistant" : "user", content: turn.content });
  }

  // Current turn with image + question
  visionMessages.push({
    role: "user",
    content: [
      { type: "image_url", image_url: { url: `data:${mimeType};base64,${imageBase64}` } },
      { type: "text", text: userQuestion },
    ],
  });

  try {
    // Stream the main analysis
    const stream = await withRetry(() => openai.chat.completions.create({
      model: GPT_MODEL,
      messages: visionMessages,
      max_completion_tokens: 512,
      stream: true,
    }));

    let fullResponse = "";
    for await (const chunk of stream) {
      const text = chunk.choices[0]?.delta?.content ?? "";
      if (text) {
        fullResponse += text;
        sseWrite({ content: text });
      }
    }

    // Generate contextual suggestions (non-streaming)
    try {
      const sugMessages = [
        ...visionMessages,
        { role: "assistant", content: fullResponse },
        {
          role: "user",
          content: 'Based on what you just observed, give me exactly 3 very short suggestions for what to look at or check next on site. Reply ONLY with a JSON array of strings. Example: ["Check the inlet pipe","Show the overflow outlet","Inspect the stand base"]',
        },
      ];
      const sugResp = await withRetry(() => openai.chat.completions.create({
        model: GPT_MODEL,
        messages: sugMessages,
        max_completion_tokens: 120,
      }));
      const raw = sugResp.choices[0]?.message?.content ?? "";
      const match = raw.match(/\[[\s\S]*\]/);
      if (match) {
        const suggestions = JSON.parse(match[0]);
        if (Array.isArray(suggestions)) sseWrite({ suggestions });
      }
    } catch {
      // suggestions are optional — don't fail if they error
    }

    sseWrite({ done: true });
    res.end();
  } catch (err: any) {
    console.error("Sky vision error:", err);
    sseWrite({ error: "Sky vision is unavailable right now. Please try again." });
    sseWrite({ done: true });
    res.end();
  }
});

export default router;
