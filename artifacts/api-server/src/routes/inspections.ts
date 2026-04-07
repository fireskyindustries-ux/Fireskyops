import { Router, type IRouter } from "express";
import { eq } from "drizzle-orm";
import { db, inspectionsTable, customersTable, enquiriesTable } from "@workspace/db";
import {
  ListInspectionsQueryParams,
  ListInspectionsResponse,
  CreateInspectionBody,
  GetInspectionParams,
  GetInspectionResponse,
  UpdateInspectionParams,
  UpdateInspectionBody,
  UpdateInspectionResponse,
} from "@workspace/api-zod";
import { requireAuth, getRole } from "../middlewares/requireAuth";
import { getAuth } from "@clerk/express";

const router: IRouter = Router();

const SELECT_FIELDS = {
  id: inspectionsTable.id,
  enquiryId: inspectionsTable.enquiryId,
  customerId: inspectionsTable.customerId,
  customerName: customersTable.name,
  farmName: inspectionsTable.farmName,
  nearestTown: inspectionsTable.nearestTown,
  manualDirections: inspectionsTable.manualDirections,
  landmarks: inspectionsTable.landmarks,
  whatsappLocation: inspectionsTable.whatsappLocation,
  accessNotes: inspectionsTable.accessNotes,
  tankSize: inspectionsTable.tankSize,
  tankQuantity: inspectionsTable.tankQuantity,
  requiresStand: inspectionsTable.requiresStand,
  requiresPlinth: inspectionsTable.requiresPlinth,
  standHeight: inspectionsTable.standHeight,
  plinthDetails: inspectionsTable.plinthDetails,
  pipeLength: inspectionsTable.pipeLength,
  pipeDetails: inspectionsTable.pipeDetails,
  distanceFromRoad: inspectionsTable.distanceFromRoad,
  distanceFromHouse: inspectionsTable.distanceFromHouse,
  truckAccess: inspectionsTable.truckAccess,
  trailerAccess: inspectionsTable.trailerAccess,
  offloadingConstraints: inspectionsTable.offloadingConstraints,
  groundCondition: inspectionsTable.groundCondition,
  siteReadyToQuote: inspectionsTable.siteReadyToQuote,
  assignedToId: inspectionsTable.assignedToId,
  photoUrls: inspectionsTable.photoUrls,
  notes: inspectionsTable.notes,
  inspectedAt: inspectionsTable.inspectedAt,
  createdAt: inspectionsTable.createdAt,
  updatedAt: inspectionsTable.updatedAt,
};

function normalize(r: any) {
  return {
    ...r,
    customerName: r.customerName ?? undefined,
    enquiryId: r.enquiryId ?? undefined,
    photoUrls: r.photoUrls ?? undefined,
    farmName: r.farmName ?? undefined,
    nearestTown: r.nearestTown ?? undefined,
    manualDirections: r.manualDirections ?? undefined,
    landmarks: r.landmarks ?? undefined,
    whatsappLocation: r.whatsappLocation ?? undefined,
    accessNotes: r.accessNotes ?? undefined,
    tankSize: r.tankSize ?? undefined,
    tankQuantity: r.tankQuantity ?? undefined,
    requiresStand: r.requiresStand ?? undefined,
    requiresPlinth: r.requiresPlinth ?? undefined,
    standHeight: r.standHeight ?? undefined,
    plinthDetails: r.plinthDetails ?? undefined,
    pipeLength: r.pipeLength ?? undefined,
    pipeDetails: r.pipeDetails ?? undefined,
    distanceFromRoad: r.distanceFromRoad ?? undefined,
    distanceFromHouse: r.distanceFromHouse ?? undefined,
    truckAccess: r.truckAccess ?? undefined,
    trailerAccess: r.trailerAccess ?? undefined,
    offloadingConstraints: r.offloadingConstraints ?? undefined,
    groundCondition: r.groundCondition ?? undefined,
    siteReadyToQuote: r.siteReadyToQuote ?? undefined,
    assignedToId: r.assignedToId ?? undefined,
    notes: r.notes ?? undefined,
    inspectedAt: r.inspectedAt ?? undefined,
  };
}

router.get("/inspections", requireAuth, async (req, res): Promise<void> => {
  const query = ListInspectionsQueryParams.safeParse(req.query);
  if (!query.success) {
    res.status(400).json({ error: query.error.message });
    return;
  }

  const role = (req as any).userRole;
  const userId = (req as any).userId;

  let rows = await db
    .select(SELECT_FIELDS)
    .from(inspectionsTable)
    .leftJoin(customersTable, eq(inspectionsTable.customerId, customersTable.id))
    .orderBy(inspectionsTable.createdAt);

  if (role === "user") {
    rows = rows.filter((r) => r.assignedToId === userId);
  }
  if (query.data.customerId) {
    rows = rows.filter((r) => r.customerId === query.data.customerId);
  }
  if (query.data.enquiryId) {
    rows = rows.filter((r) => r.enquiryId === query.data.enquiryId);
  }

  res.json(ListInspectionsResponse.parse(rows.map(normalize)));
});

router.post("/inspections", requireAuth, async (req, res): Promise<void> => {
  const parsed = CreateInspectionBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const [inspection] = await db.insert(inspectionsTable).values(parsed.data).returning();

  const [customer] = await db
    .select()
    .from(customersTable)
    .where(eq(customersTable.id, inspection.customerId));

  // Auto-advance enquiry status to inspection_done if linked
  if (inspection.enquiryId) {
    const [enquiry] = await db
      .select()
      .from(enquiriesTable)
      .where(eq(enquiriesTable.id, inspection.enquiryId));
    if (enquiry && (enquiry.status === "new" || enquiry.status === "in_progress")) {
      await db
        .update(enquiriesTable)
        .set({ status: "inspection_done", updatedAt: new Date() })
        .where(eq(enquiriesTable.id, inspection.enquiryId));
    }
  }

  const { notifyAdmins } = await import("../lib/notify");
  notifyAdmins(
    `New site inspection — ${customer?.name || "Unknown customer"}`,
    null,
    `/inspections/${inspection.id}`
  );

  res.status(201).json(
    GetInspectionResponse.parse(normalize({
      ...inspection,
      customerName: customer?.name,
    })),
  );
});

router.get("/inspections/:id", requireAuth, async (req, res): Promise<void> => {
  const params = GetInspectionParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const role = (req as any).userRole;
  const userId = (req as any).userId;

  const [row] = await db
    .select(SELECT_FIELDS)
    .from(inspectionsTable)
    .leftJoin(customersTable, eq(inspectionsTable.customerId, customersTable.id))
    .where(eq(inspectionsTable.id, params.data.id));

  if (!row) {
    res.status(404).json({ error: "Inspection not found" });
    return;
  }

  if (role === "user" && row.assignedToId !== userId) {
    res.status(403).json({ error: "Not assigned to you" });
    return;
  }

  res.json(GetInspectionResponse.parse(normalize(row)));
});

router.put("/inspections/:id", requireAuth, async (req, res): Promise<void> => {
  const params = UpdateInspectionParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const parsed = UpdateInspectionBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const [inspection] = await db
    .update(inspectionsTable)
    .set({ ...parsed.data, updatedAt: new Date() })
    .where(eq(inspectionsTable.id, params.data.id))
    .returning();

  if (!inspection) {
    res.status(404).json({ error: "Inspection not found" });
    return;
  }

  const [customer] = await db
    .select()
    .from(customersTable)
    .where(eq(customersTable.id, inspection.customerId));

  res.json(
    UpdateInspectionResponse.parse(normalize({
      ...inspection,
      customerName: customer?.name,
    })),
  );
});

router.patch("/inspections/:id/assign", requireAuth, async (req, res): Promise<void> => {
  const role = (req as any).userRole;
  if (role !== "admin") {
    res.status(403).json({ error: "Admin only" });
    return;
  }

  const id = Number(req.params.id);
  if (!id) {
    res.status(400).json({ error: "Invalid id" });
    return;
  }

  const { assignedToId } = req.body;

  const [inspection] = await db
    .update(inspectionsTable)
    .set({ assignedToId: assignedToId ?? null, updatedAt: new Date() })
    .where(eq(inspectionsTable.id, id))
    .returning();

  if (!inspection) {
    res.status(404).json({ error: "Inspection not found" });
    return;
  }

  res.json({ id: inspection.id, assignedToId: inspection.assignedToId });
});

export default router;
