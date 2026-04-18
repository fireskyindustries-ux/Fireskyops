import OpenAI from "openai";
import { pool } from "@workspace/db";
import { brand } from "../brand.config";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

const DB_SCHEMA = `
PostgreSQL database schema for ${brand.name} field operations:

TABLE customers (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT,
  phone TEXT,
  "farmName" TEXT,
  "nearestTown" TEXT,
  province TEXT,
  notes TEXT,
  "contactName" TEXT,
  "accessNotes" TEXT,
  "createdAt" TIMESTAMPTZ,
  "updatedAt" TIMESTAMPTZ
)

TABLE enquiries (
  id SERIAL PRIMARY KEY,
  "customerId" INTEGER REFERENCES customers(id),
  title TEXT,
  description TEXT,
  status TEXT, -- values: new, in_progress, inspection_done, quoted, won, lost, closed
  priority TEXT, -- values: low, medium, high
  "tankSize" TEXT,
  "tankQuantity" INTEGER,
  notes TEXT,
  "createdAt" TIMESTAMPTZ,
  "updatedAt" TIMESTAMPTZ
)

TABLE jobs (
  id SERIAL PRIMARY KEY,
  "customerId" INTEGER REFERENCES customers(id),
  "enquiryId" INTEGER REFERENCES enquiries(id),
  "inspectionId" INTEGER REFERENCES inspections(id),
  title TEXT,
  stage TEXT, -- values: enquiry, inspection, quoting, quoted, won, lost, closed
  priority TEXT, -- values: low, medium, high
  "jobType" TEXT, -- values: full_install, delivery_only
  "tankSize" TEXT,
  "tankQuantity" INTEGER,
  "estimatedValue" NUMERIC,
  "assignedStaff" TEXT,
  notes TEXT,
  "createdAt" TIMESTAMPTZ,
  "updatedAt" TIMESTAMPTZ
)

TABLE inspections (
  id SERIAL PRIMARY KEY,
  "customerId" INTEGER REFERENCES customers(id),
  "enquiryId" INTEGER REFERENCES enquiries(id),
  "farmName" TEXT,
  "nearestTown" TEXT,
  "whatsappLocation" TEXT,
  "manualDirections" TEXT,
  landmarks TEXT,
  "accessNotes" TEXT,
  "tankSize" TEXT,
  "tankQuantity" INTEGER,
  "requiresStand" BOOLEAN,
  "standHeight" TEXT,
  "requiresPlinth" BOOLEAN,
  "plinthDetails" TEXT,
  "pipeLength" NUMERIC,
  "pipeDetails" TEXT,
  "distanceFromRoad" NUMERIC,
  "distanceFromHouse" NUMERIC,
  "truckAccess" BOOLEAN,
  "trailerAccess" BOOLEAN,
  "offloadingConstraints" TEXT,
  "groundCondition" TEXT,
  "siteReadyToQuote" BOOLEAN,
  notes TEXT,
  "inspectedAt" TIMESTAMPTZ,
  "createdAt" TIMESTAMPTZ,
  "updatedAt" TIMESTAMPTZ
)

TABLE job_loads (
  id SERIAL PRIMARY KEY,
  "jobId" INTEGER REFERENCES jobs(id),
  "tankSize" TEXT,
  "tankQuantity" INTEGER,
  "deliveredAt" TIMESTAMPTZ,
  "driverName" TEXT,
  "vehicleReg" TEXT,
  notes TEXT,
  "createdAt" TIMESTAMPTZ,
  "updatedAt" TIMESTAMPTZ
)

TABLE appointments (
  id SERIAL PRIMARY KEY,
  "customerId" INTEGER REFERENCES customers(id),
  "jobId" INTEGER REFERENCES jobs(id),
  "enquiryId" INTEGER REFERENCES enquiries(id),
  title TEXT,
  description TEXT,
  "startTime" TIMESTAMPTZ,
  "endTime" TIMESTAMPTZ,
  "allDay" BOOLEAN,
  location TEXT,
  "assignedTo" TEXT,
  notes TEXT,
  "createdAt" TIMESTAMPTZ,
  "updatedAt" TIMESTAMPTZ
)
`.trim();

const SYSTEM_PROMPT = `You are a read-only SQL query generator for a PostgreSQL database used by ${brand.name}.
Given a natural language question, generate a safe SELECT query that answers it.
Rules:
- Only generate SELECT statements. Never INSERT, UPDATE, DELETE, DROP, TRUNCATE, or ALTER.
- Use proper double-quoted column names as shown in the schema.
- Keep queries concise and return only the most relevant columns.
- Return ONLY the raw SQL query — no markdown fences, no explanation, nothing else.
- Limit results to 50 rows unless the question implies a count or aggregate.
- Current date is ${new Date().toISOString().split("T")[0]}.`;

function isSafeQuery(sql: string): boolean {
  const upper = sql.trim().toUpperCase();
  if (!upper.startsWith("SELECT")) return false;
  const dangerous = ["INSERT", "UPDATE", "DELETE", "DROP", "TRUNCATE", "ALTER", "CREATE", "GRANT", "REVOKE", "EXECUTE", "EXEC", "--", ";-"];
  return !dangerous.some((kw) => upper.includes(kw));
}

export async function smartQuery(question: string): Promise<string> {
  const response = await openai.chat.completions.create({
    model: "gpt-5",
    messages: [
      { role: "system", content: SYSTEM_PROMPT },
      { role: "user", content: `Database schema:\n${DB_SCHEMA}\n\nQuestion: ${question}` },
    ],
    max_tokens: 512,
  });

  const rawSql = (response.choices[0]?.message?.content ?? "").trim()
    .replace(/^```sql\n?/i, "")
    .replace(/```$/, "")
    .trim();

  if (!rawSql || !isSafeQuery(rawSql)) {
    return `Could not generate a safe query for: "${question}"`;
  }

  try {
    const result = await pool.query(rawSql);
    const rows = result.rows;
    if (!rows.length) return "No results found.";
    return JSON.stringify(rows, null, 2);
  } catch (err: any) {
    return `Query error: ${err.message}`;
  }
}
