import { Router, type IRouter } from "express";
import { z } from "zod";
import { db, customersTable, enquiriesTable } from "@workspace/db";
import { eq, or } from "drizzle-orm";
import { notifyAdmins } from "../lib/notify";
import { logger } from "../lib/logger";

const router: IRouter = Router();

const WebsiteEnquiryBody = z.object({
  name: z.string().min(1),
  phone: z.string().min(1),
  email: z.string().email().optional().or(z.literal("")),
  nearestTown: z.string().optional(),
  province: z.string().optional(),
  message: z.string().min(1),
  tankSize: z.string().optional(),
  tankQuantity: z.coerce.number().int().positive().optional(),
});

// Public endpoint — no auth required
router.post("/website/enquiry", async (req, res): Promise<void> => {
  const parsed = WebsiteEnquiryBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const { name, phone, email, nearestTown, province, message, tankSize, tankQuantity } = parsed.data;

  try {
    // Find existing customer by phone or email, or create new one
    let customer = null;

    if (phone) {
      const rows = await db
        .select()
        .from(customersTable)
        .where(eq(customersTable.phone, phone))
        .limit(1);
      customer = rows[0] ?? null;
    }

    if (!customer && email) {
      const rows = await db
        .select()
        .from(customersTable)
        .where(eq(customersTable.email, email))
        .limit(1);
      customer = rows[0] ?? null;
    }

    if (!customer) {
      const [created] = await db
        .insert(customersTable)
        .values({
          name,
          phone: phone || null,
          email: email || null,
          nearestTown: nearestTown || null,
          province: province || null,
          notes: "Created via website enquiry form",
        })
        .returning();
      customer = created;
    }

    const title = tankSize
      ? `Website Enquiry — ${tankQuantity ? `${tankQuantity}x ` : ""}${tankSize}`
      : "Website Enquiry";

    const [enquiry] = await db
      .insert(enquiriesTable)
      .values({
        customerId: customer.id,
        title,
        description: message,
        tankSize: tankSize || null,
        tankQuantity: tankQuantity || null,
        status: "new",
        priority: "medium",
        notes: `Submitted via website by ${name} — ${phone}${email ? `, ${email}` : ""}${nearestTown ? `, ${nearestTown}` : ""}`,
      })
      .returning();

    notifyAdmins(
      `Website enquiry — ${name}`,
      message.slice(0, 120),
      `/enquiries/${enquiry.id}`
    );

    res.status(201).json({ ok: true, enquiryId: enquiry.id });
  } catch (err) {
    logger.error({ err }, "Failed to create website enquiry");
    res.status(500).json({ error: "Failed to submit enquiry" });
  }
});

export default router;
