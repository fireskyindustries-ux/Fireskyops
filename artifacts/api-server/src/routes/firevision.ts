import { Router } from "express";
import { db } from "@workspace/db";
import { customersTable, enquiriesTable } from "@workspace/db/schema";
import { eq } from "drizzle-orm";
import { z } from "zod/v4";

const router = Router();

const payloadSchema = z.object({
  name:                 z.string(),
  email:                z.string().min(1, "email is required"),
  phone:                z.string().optional(),
  location:             z.string().optional(),
  problem_need:         z.string().optional(),
  recommended_solution: z.string().optional(),
  additional_notes:     z.string().optional(),
  source:               z.string().optional(),
  priority:             z.enum(["low", "medium", "high"]).optional().default("medium"),
  status:               z.string().optional().default("new"),
});

router.post("/ingest/firevision", async (req, res): Promise<void> => {
  const parsed = payloadSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid payload", details: parsed.error.flatten() });
    return;
  }

  const {
    name, email, phone, location,
    problem_need, recommended_solution, additional_notes,
    source, priority, status,
  } = parsed.data;

  console.log(`[Fire Vision] Ingest received — name: ${name}, email: ${email}, phone: ${phone ?? "n/a"}`);

  try {
    // Find existing customer by phone, or create new
    let customerId: number;
    if (phone) {
      const existing = await db
        .select({ id: customersTable.id, email: customersTable.email })
        .from(customersTable)
        .where(eq(customersTable.phone, phone))
        .limit(1);

      if (existing.length > 0) {
        customerId = existing[0].id;
        // Update email if the customer doesn't have one stored yet
        if (!existing[0].email) {
          await db
            .update(customersTable)
            .set({ email })
            .where(eq(customersTable.id, customerId));
        }
      } else {
        const [created] = await db
          .insert(customersTable)
          .values({
            name,
            email,
            phone,
            ...(location ? { notes: `Location: ${location}` } : {}),
          })
          .returning({ id: customersTable.id });
        customerId = created.id;
      }
    } else {
      const [created] = await db
        .insert(customersTable)
        .values({
          name,
          email,
          ...(location ? { notes: `Location: ${location}` } : {}),
        })
        .returning({ id: customersTable.id });
      customerId = created.id;
    }

    // Build title from problem_need or customer name
    const rawTitle = problem_need ?? `Enquiry from ${name}`;
    const title = rawTitle.length > 100 ? rawTitle.slice(0, 100) + "…" : rawTitle;

    // Build description from structured fields
    const parts: string[] = [];
    if (problem_need)         parts.push(`Need: ${problem_need}`);
    if (recommended_solution) parts.push(`Recommended: ${recommended_solution}`);
    if (additional_notes)     parts.push(`Notes: ${additional_notes}`);
    const description = parts.length ? parts.join("\n\n") : undefined;

    // Build notes line
    const noteParts: string[] = [];
    if (source)   noteParts.push(`Source: ${source}`);
    if (location) noteParts.push(`Location: ${location}`);
    const notes = noteParts.length ? noteParts.join(" | ") : undefined;

    const [enquiry] = await db
      .insert(enquiriesTable)
      .values({ customerId, title, description, notes, priority, status })
      .returning({ id: enquiriesTable.id });

    res.status(201).json({ success: true, enquiryId: enquiry.id, customerId });
  } catch {
    res.status(500).json({ error: "Failed to create enquiry" });
  }
});

// Simple receive-and-log endpoint for Fire Vision agent compatibility
router.post("/firevision/enquiry", (req, res): void => {
  console.log("[Fire Vision] Enquiry received:", JSON.stringify(req.body, null, 2));
  res.json({ success: true, message: "Enquiry received" });
});

export default router;
