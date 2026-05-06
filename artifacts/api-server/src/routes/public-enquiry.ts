import { Router, type IRouter } from "express";
import { db, customersTable, enquiriesTable } from "@workspace/db";
import { notifyAdmins } from "../lib/notify";

const router: IRouter = Router();

router.post("/public-enquiry", async (req, res): Promise<void> => {
  const { name, phone, email, tankSize, tankQuantity, location, message } = req.body as {
    name?: string;
    phone?: string;
    email?: string;
    tankSize?: string;
    tankQuantity?: number;
    location?: string;
    message?: string;
  };

  if (!name || name.trim().length < 2) {
    res.status(400).json({ error: "Please enter your name." });
    return;
  }
  if (!phone && !email) {
    res.status(400).json({ error: "Please provide a phone number or email address so we can contact you." });
    return;
  }

  const [customer] = await db
    .insert(customersTable)
    .values({
      name: name.trim(),
      phone: phone?.trim() || undefined,
      email: email?.trim() || undefined,
      nearestTown: location?.trim() || undefined,
      notes: "Created via public quote request form",
    })
    .returning();

  const title = [
    tankSize,
    tankQuantity ? `x${tankQuantity}` : null,
    "tank enquiry",
    location ? `— ${location}` : null,
  ]
    .filter(Boolean)
    .join(" ") || "Quote request";

  const [enquiry] = await db
    .insert(enquiriesTable)
    .values({
      customerId: customer.id,
      title,
      tankSize: tankSize?.trim() || undefined,
      tankQuantity: tankQuantity ? Number(tankQuantity) : undefined,
      description: message?.trim() || undefined,
      status: "new",
      priority: "medium",
      notes: "Submitted via public quote request form",
    })
    .returning();

  await notifyAdmins(
    "New quote request",
    `${name} is looking for${tankSize ? ` a ${tankSize}` : " a"} tank${location ? ` in ${location}` : ""}`,
    `/enquiries/${enquiry.id}`,
  ).catch(() => {});

  res.json({ success: true, enquiryId: enquiry.id });
});

export default router;
