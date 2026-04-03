import { Router, type IRouter } from "express";
import { eq } from "drizzle-orm";
import { db, inspectionsTable, customersTable } from "@workspace/db";
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

const router: IRouter = Router();

router.get("/inspections", async (req, res): Promise<void> => {
  const query = ListInspectionsQueryParams.safeParse(req.query);
  if (!query.success) {
    res.status(400).json({ error: query.error.message });
    return;
  }

  let rows = await db
    .select({
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
      photoUrls: inspectionsTable.photoUrls,
      notes: inspectionsTable.notes,
      inspectedAt: inspectionsTable.inspectedAt,
      createdAt: inspectionsTable.createdAt,
      updatedAt: inspectionsTable.updatedAt,
    })
    .from(inspectionsTable)
    .leftJoin(customersTable, eq(inspectionsTable.customerId, customersTable.id))
    .orderBy(inspectionsTable.createdAt);

  if (query.data.customerId) {
    rows = rows.filter((r) => r.customerId === query.data.customerId);
  }
  if (query.data.enquiryId) {
    rows = rows.filter((r) => r.enquiryId === query.data.enquiryId);
  }

  const normalized = rows.map((r) => ({
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
    notes: r.notes ?? undefined,
    inspectedAt: r.inspectedAt ?? undefined,
  }));
  res.json(ListInspectionsResponse.parse(normalized));
});

router.post("/inspections", async (req, res): Promise<void> => {
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

  res.status(201).json(
    GetInspectionResponse.parse({
      ...inspection,
      customerName: customer?.name ?? undefined,
      enquiryId: inspection.enquiryId ?? undefined,
      photoUrls: inspection.photoUrls ?? undefined,
    }),
  );
});

router.get("/inspections/:id", async (req, res): Promise<void> => {
  const params = GetInspectionParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const [row] = await db
    .select({
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
      photoUrls: inspectionsTable.photoUrls,
      notes: inspectionsTable.notes,
      inspectedAt: inspectionsTable.inspectedAt,
      createdAt: inspectionsTable.createdAt,
      updatedAt: inspectionsTable.updatedAt,
    })
    .from(inspectionsTable)
    .leftJoin(customersTable, eq(inspectionsTable.customerId, customersTable.id))
    .where(eq(inspectionsTable.id, params.data.id));

  if (!row) {
    res.status(404).json({ error: "Inspection not found" });
    return;
  }

  res.json(GetInspectionResponse.parse({
    ...row,
    customerName: row.customerName ?? undefined,
    enquiryId: row.enquiryId ?? undefined,
    photoUrls: row.photoUrls ?? undefined,
    farmName: row.farmName ?? undefined,
    nearestTown: row.nearestTown ?? undefined,
    manualDirections: row.manualDirections ?? undefined,
    landmarks: row.landmarks ?? undefined,
    whatsappLocation: row.whatsappLocation ?? undefined,
    accessNotes: row.accessNotes ?? undefined,
    tankSize: row.tankSize ?? undefined,
    tankQuantity: row.tankQuantity ?? undefined,
    requiresStand: row.requiresStand ?? undefined,
    requiresPlinth: row.requiresPlinth ?? undefined,
    standHeight: row.standHeight ?? undefined,
    plinthDetails: row.plinthDetails ?? undefined,
    pipeLength: row.pipeLength ?? undefined,
    pipeDetails: row.pipeDetails ?? undefined,
    distanceFromRoad: row.distanceFromRoad ?? undefined,
    distanceFromHouse: row.distanceFromHouse ?? undefined,
    truckAccess: row.truckAccess ?? undefined,
    trailerAccess: row.trailerAccess ?? undefined,
    offloadingConstraints: row.offloadingConstraints ?? undefined,
    groundCondition: row.groundCondition ?? undefined,
    siteReadyToQuote: row.siteReadyToQuote ?? undefined,
    notes: row.notes ?? undefined,
    inspectedAt: row.inspectedAt ?? undefined,
  }));
});

router.put("/inspections/:id", async (req, res): Promise<void> => {
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
    UpdateInspectionResponse.parse({
      ...inspection,
      customerName: customer?.name ?? undefined,
      enquiryId: inspection.enquiryId ?? undefined,
      photoUrls: inspection.photoUrls ?? undefined,
    }),
  );
});

export default router;
