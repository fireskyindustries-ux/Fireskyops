import { Router, type IRouter } from "express";
import { db, customersTable, enquiriesTable } from "@workspace/db";
import OpenAI from "openai";

const router: IRouter = Router();
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

const API_KEY = process.env.LIVE_DATA_API_KEY;

router.post("/process-lead", async (req, res): Promise<void> => {
  const authHeader = req.headers["x-api-key"];
  if (!API_KEY || authHeader !== API_KEY) {
    res.status(403).json({ error: "Unauthorized" });
    return;
  }

  const { text, source } = req.body as { text?: string; source?: string };
  if (!text || text.trim().length < 20) {
    res.status(400).json({ error: "text is required and must be meaningful content" });
    return;
  }

  const truncated = text.slice(0, 6000);

  let extracted: {
    name: string | null;
    phone: string | null;
    email: string | null;
    location: string | null;
    tankSize: string | null;
    tankQuantity: number | null;
    notes: string | null;
    confidence: "high" | "medium" | "low";
  };

  try {
    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      temperature: 0,
      response_format: { type: "json_object" },
      messages: [
        {
          role: "system",
          content: `You are a lead extraction assistant for a water tank and field service company in South Africa.
Extract structured lead information from raw website/page text.
Return a JSON object with these fields:
- name: string | null — customer or business name
- phone: string | null — South African phone number if present
- email: string | null — email address if present
- location: string | null — city, town, or region mentioned
- tankSize: string | null — tank size mentioned e.g. "10000L", "5000 litre"
- tankQuantity: number | null — number of tanks if mentioned
- notes: string | null — any other relevant detail (urgent need, specific requirements)
- confidence: "high" | "medium" | "low" — how confident you are this is a real lead

If the page does not appear to contain a genuine lead or inquiry, set confidence to "low".
Return only valid JSON.`,
        },
        {
          role: "user",
          content: `Source URL: ${source ?? "unknown"}\n\nPage text:\n${truncated}`,
        },
      ],
    });

    extracted = JSON.parse(completion.choices[0].message.content ?? "{}");
  } catch (err) {
    res.status(500).json({ error: "AI extraction failed", detail: String(err) });
    return;
  }

  if (extracted.confidence === "low") {
    res.json({
      status: "skipped",
      reason: "AI determined page does not contain a genuine lead",
      extracted,
    });
    return;
  }

  const customerName = extracted.name ?? "Unknown Lead";
  const [customer] = await db
    .insert(customersTable)
    .values({
      name: customerName,
      phone: extracted.phone ?? undefined,
      email: extracted.email ?? undefined,
      nearestTown: extracted.location ?? undefined,
      notes: `Auto-created from lead scraper. Source: ${source ?? "unknown"}`,
    })
    .returning();

  const title = [
    extracted.tankSize,
    extracted.tankQuantity ? `x${extracted.tankQuantity}` : null,
    "tank enquiry",
    extracted.location ? `— ${extracted.location}` : null,
  ]
    .filter(Boolean)
    .join(" ");

  const [enquiry] = await db
    .insert(enquiriesTable)
    .values({
      customerId: customer.id,
      title: title || "Tank enquiry (scraped lead)",
      tankSize: extracted.tankSize ?? undefined,
      tankQuantity: extracted.tankQuantity ?? undefined,
      description: extracted.notes ?? undefined,
      status: "new",
      priority: "medium",
      notes: `Lead scraped automatically. Source: ${source ?? "unknown"}`,
    })
    .returning();

  res.json({
    status: "created",
    confidence: extracted.confidence,
    customer: { id: customer.id, name: customer.name },
    enquiry: { id: enquiry.id, title: enquiry.title },
    extracted,
  });
});

export default router;
