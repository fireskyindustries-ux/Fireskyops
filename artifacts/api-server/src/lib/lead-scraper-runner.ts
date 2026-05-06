import { db, customersTable, enquiriesTable } from "@workspace/db";
import OpenAI from "openai";
import { logger } from "./logger";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
const SERPER_API_KEY = process.env.SERPER_API_KEY ?? "";
const LIVE_DATA_API_KEY = process.env.LIVE_DATA_API_KEY ?? "";

const QUERIES = [
  "10000L water tank price South Africa",
  "10000 litre JoJo tank quote",
  "buy 10000L water storage tank",
  "5000L water tank price South Africa",
  "5000 litre tank quote Johannesburg",
  "buy 5000L JoJo tank",
  "2500L water tank South Africa price",
  "2500 litre tank quote",
  "1000L water tank price South Africa",
  "1000 litre tank buy",
  "water tank installation quote South Africa",
  "JoJo tank price list South Africa",
  "water storage tank supplier South Africa",
  "rainwater harvesting tank South Africa",
  "plastic water tank buy South Africa",
  "water tank for farm South Africa",
  "borehole water storage tank",
  "off-grid water tank installation",
  "water pump price South Africa",
  "borehole pump quote South Africa",
  "submersible pump supplier South Africa",
  "pressure pump installation quote",
  "irrigation pump South Africa price",
  "solar water pump South Africa",
  "water pump for farm South Africa",
  "water tank Bloemfontein price",
  "water tank Cape Town quote",
  "water tank Pretoria installation",
  "water tank Durban supplier",
  "water tank Free State farm",
  "water tank Northern Cape",
];

const USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36";

function stripHtml(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/\s{2,}/g, " ")
    .trim();
}

async function searchSerper(query: string): Promise<string[]> {
  const resp = await fetch("https://google.serper.dev/search", {
    method: "POST",
    headers: { "X-API-KEY": SERPER_API_KEY, "Content-Type": "application/json" },
    body: JSON.stringify({ q: query, gl: "za", hl: "en", num: 5 }),
    signal: AbortSignal.timeout(15_000),
  });
  if (!resp.ok) throw new Error(`Serper error: ${resp.status}`);
  const data = (await resp.json()) as { organic?: { link: string }[] };
  return (data.organic ?? []).slice(0, 5).map((r) => r.link);
}

async function scrapePage(url: string): Promise<string> {
  try {
    const resp = await fetch(url, {
      headers: { "User-Agent": USER_AGENT },
      signal: AbortSignal.timeout(10_000),
    });
    if (!resp.ok) return "";
    const html = await resp.text();
    const text = stripHtml(html).slice(0, 6000);
    return text;
  } catch {
    return "";
  }
}

interface Extracted {
  name: string | null;
  phone: string | null;
  email: string | null;
  location: string | null;
  tankSize: string | null;
  tankQuantity: number | null;
  notes: string | null;
  confidence: "high" | "medium" | "low";
}

async function extractLead(text: string, source: string): Promise<Extracted> {
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
- confidence: "high" | "medium" | "low" — how confident you are this is a real lead with contact details

If the page does not appear to contain a genuine lead or inquiry with contact details, set confidence to "low".
Return only valid JSON.`,
      },
      {
        role: "user",
        content: `Source URL: ${source}\n\nPage text:\n${text}`,
      },
    ],
  });
  return JSON.parse(completion.choices[0].message.content ?? "{}") as Extracted;
}

async function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

export async function runLeadScraper(): Promise<{ created: number; skipped: number; errors: number }> {
  if (!SERPER_API_KEY) {
    logger.warn("[lead-scraper] SERPER_API_KEY not set — skipping");
    return { created: 0, skipped: 0, errors: 0 };
  }

  let created = 0;
  let skipped = 0;
  let errors = 0;

  logger.info(`[lead-scraper] Starting — ${QUERIES.length} queries`);

  for (const query of QUERIES) {
    try {
      const urls = await searchSerper(query);
      for (const url of urls) {
        try {
          const text = await scrapePage(url);
          if (text.length < 50) { skipped++; continue; }

          const extracted = await extractLead(text, url);
          if (extracted.confidence === "low") { skipped++; continue; }

          const customerName = extracted.name ?? "Unknown Lead";
          const [customer] = await db
            .insert(customersTable)
            .values({
              name: customerName,
              phone: extracted.phone ?? undefined,
              email: extracted.email ?? undefined,
              nearestTown: extracted.location ?? undefined,
              notes: `Auto-created by lead scraper. Source: ${url}`,
            })
            .returning();

          const title = [
            extracted.tankSize,
            extracted.tankQuantity ? `x${extracted.tankQuantity}` : null,
            "tank enquiry",
            extracted.location ? `— ${extracted.location}` : null,
          ]
            .filter(Boolean)
            .join(" ") || "Tank enquiry (scraped lead)";

          await db.insert(enquiriesTable).values({
            customerId: customer.id,
            title,
            tankSize: extracted.tankSize ?? undefined,
            tankQuantity: extracted.tankQuantity ?? undefined,
            description: extracted.notes ?? undefined,
            status: "new",
            priority: "medium",
            notes: `Lead scraped automatically. Source: ${url}`,
          });

          created++;
          logger.info(`[lead-scraper] Created: ${customerName} — ${title}`);
          await sleep(500);
        } catch (err) {
          logger.error({ err }, `[lead-scraper] Error processing ${url}`);
          errors++;
        }
      }
    } catch (err) {
      logger.error({ err }, `[lead-scraper] Serper error for query: ${query}`);
      errors++;
    }
    await sleep(1000);
  }

  logger.info(`[lead-scraper] Done — created: ${created}, skipped: ${skipped}, errors: ${errors}`);
  return { created, skipped, errors };
}
