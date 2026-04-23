import { Router, type IRouter } from "express";
import { eq, ilike, or, and } from "drizzle-orm";
import { db, customersTable, type Customer } from "@workspace/db";
import { isAdmin, getBranchId } from "../middlewares/requireAuth";

function normalizeCustomer(c: Customer) {
  return {
    ...c,
    contactName: c.contactName ?? undefined,
    phone: c.phone ?? undefined,
    email: c.email ?? undefined,
    vatNumber: (c as any).vatNumber ?? undefined,
    billingAddress: (c as any).billingAddress ?? undefined,
    billingCity: (c as any).billingCity ?? undefined,
    billingProvince: (c as any).billingProvince ?? undefined,
    billingPostalCode: (c as any).billingPostalCode ?? undefined,
    farmName: c.farmName ?? undefined,
    nearestTown: c.nearestTown ?? undefined,
    province: c.province ?? undefined,
    manualDirections: c.manualDirections ?? undefined,
    landmarks: c.landmarks ?? undefined,
    whatsappLocation: c.whatsappLocation ?? undefined,
    lat: c.lat ?? undefined,
    lng: c.lng ?? undefined,
    accessNotes: c.accessNotes ?? undefined,
    notes: c.notes ?? undefined,
  };
}

/** Parse lat/lng from a whatsappLocation string (coords or Google Maps URL). */
function parseCoordsFromText(raw: string | null | undefined): { lat: number; lng: number } | null {
  if (!raw) return null;
  const s = raw.trim();
  // Google Maps URL: ?q=lat,lng or &q=lat,lng
  const qMatch = s.match(/[?&]q=(-?\d+\.?\d*)[, ]+(-?\d+\.?\d*)/);
  if (qMatch) {
    const lat = parseFloat(qMatch[1]);
    const lng = parseFloat(qMatch[2]);
    if (!isNaN(lat) && !isNaN(lng)) return { lat, lng };
  }
  // Google Maps @ format: /@lat,lng
  const atMatch = s.match(/\/@(-?\d+\.?\d*),(-?\d+\.?\d*)/);
  if (atMatch) {
    const lat = parseFloat(atMatch[1]);
    const lng = parseFloat(atMatch[2]);
    if (!isNaN(lat) && !isNaN(lng)) return { lat, lng };
  }
  // Plain "lat, lng" or "lat,lng"
  const coordMatch = s.match(/^(-?\d+\.?\d*)[, ]+(-?\d+\.?\d*)$/);
  if (coordMatch) {
    const lat = parseFloat(coordMatch[1]);
    const lng = parseFloat(coordMatch[2]);
    if (!isNaN(lat) && !isNaN(lng)) return { lat, lng };
  }
  return null;
}

/** Geocode a town/province string using Nominatim (OpenStreetMap). Returns null on failure. */
async function geocodeTown(town: string, province?: string | null): Promise<{ lat: number; lng: number } | null> {
  try {
    const query = [town, province, "South Africa"].filter(Boolean).join(", ");
    const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(query)}&format=json&limit=1&countrycodes=za`;
    const res = await fetch(url, {
      headers: { "User-Agent": "FireskyOps/1.0 (fireskyops.tech)" },
    });
    if (!res.ok) return null;
    const data: any[] = await res.json();
    if (!data.length) return null;
    return { lat: parseFloat(data[0].lat), lng: parseFloat(data[0].lon) };
  } catch {
    return null;
  }
}

/** Resolve coordinates for a customer record — GPS first, town fallback. */
async function resolveCoords(
  whatsappLocation: string | null | undefined,
  nearestTown: string | null | undefined,
  province: string | null | undefined,
): Promise<{ lat: number | null; lng: number | null }> {
  const fromGps = parseCoordsFromText(whatsappLocation);
  if (fromGps) return fromGps;
  if (nearestTown) {
    const fromTown = await geocodeTown(nearestTown, province);
    if (fromTown) return fromTown;
  }
  return { lat: null, lng: null };
}
import {
  ListCustomersQueryParams,
  CreateCustomerBody,
  GetCustomerParams,
  GetCustomerResponse,
  UpdateCustomerParams,
  UpdateCustomerBody,
  UpdateCustomerResponse,
  DeleteCustomerParams,
  ListCustomersResponse,
  CreateCustomerBody as CreateCustomerResponse,
} from "@workspace/api-zod";

const router: IRouter = Router();

router.get("/customers", async (req, res): Promise<void> => {
  const query = ListCustomersQueryParams.safeParse(req.query);
  if (!query.success) {
    res.status(400).json({ error: query.error.message });
    return;
  }

  const branchId = isAdmin(req) ? null : getBranchId(req);

  let customers;
  if (query.data.search) {
    const s = `%${query.data.search}%`;
    const searchCondition = or(
      ilike(customersTable.name, s),
      ilike(customersTable.farmName, s),
      ilike(customersTable.nearestTown, s),
      ilike(customersTable.contactName, s),
    );
    customers = await db
      .select()
      .from(customersTable)
      .where(branchId ? and(searchCondition, eq(customersTable.branchId, branchId)) : searchCondition)
      .orderBy(customersTable.createdAt);
  } else {
    customers = await db
      .select()
      .from(customersTable)
      .where(branchId ? eq(customersTable.branchId, branchId) : undefined)
      .orderBy(customersTable.createdAt);
  }

  res.json(ListCustomersResponse.parse(customers.map(normalizeCustomer)));
});

router.post("/customers", async (req, res): Promise<void> => {
  const parsed = CreateCustomerBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const branchId = getBranchId(req) ?? undefined;
  const coords = await resolveCoords(parsed.data.whatsappLocation, parsed.data.nearestTown, parsed.data.province);
  const [customer] = await db
    .insert(customersTable)
    .values({ ...parsed.data, branchId, lat: coords.lat, lng: coords.lng })
    .returning();
  res.status(201).json(GetCustomerResponse.parse(normalizeCustomer(customer)));
});

router.get("/customers/:id", async (req, res): Promise<void> => {
  const params = GetCustomerParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const [customer] = await db
    .select()
    .from(customersTable)
    .where(eq(customersTable.id, params.data.id));

  if (!customer) {
    res.status(404).json({ error: "Customer not found" });
    return;
  }

  res.json(GetCustomerResponse.parse(normalizeCustomer(customer)));
});

router.put("/customers/:id", async (req, res): Promise<void> => {
  const params = UpdateCustomerParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const parsed = UpdateCustomerBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const coords = await resolveCoords(parsed.data.whatsappLocation, parsed.data.nearestTown, parsed.data.province);
  const [customer] = await db
    .update(customersTable)
    .set({ ...parsed.data, lat: coords.lat, lng: coords.lng, updatedAt: new Date() })
    .where(eq(customersTable.id, params.data.id))
    .returning();

  if (!customer) {
    res.status(404).json({ error: "Customer not found" });
    return;
  }

  res.json(UpdateCustomerResponse.parse(normalizeCustomer(customer)));
});

/** POST /customers/geocode-all — admin only, backfills lat/lng for all customers missing coordinates */
router.post("/customers/geocode-all", async (req: any, res): Promise<void> => {
  if (!isAdmin(req)) {
    res.status(403).json({ error: "Admin only" });
    return;
  }
  const { isNull, or } = await import("drizzle-orm");
  const unresolved = await db
    .select()
    .from(customersTable)
    .where(or(isNull(customersTable.lat), isNull(customersTable.lng)));

  let updated = 0;
  let failed = 0;
  for (const c of unresolved) {
    const coords = await resolveCoords(c.whatsappLocation, c.nearestTown, c.province);
    if (coords.lat != null && coords.lng != null) {
      await db
        .update(customersTable)
        .set({ lat: coords.lat, lng: coords.lng })
        .where(eq(customersTable.id, c.id));
      updated++;
    } else {
      failed++;
    }
    // Nominatim rate limit: 1 request/second
    await new Promise((r) => setTimeout(r, 1100));
  }
  res.json({ total: unresolved.length, updated, failed });
});

router.delete("/customers/:id", async (req, res): Promise<void> => {
  const params = DeleteCustomerParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const [customer] = await db
    .delete(customersTable)
    .where(eq(customersTable.id, params.data.id))
    .returning();

  if (!customer) {
    res.status(404).json({ error: "Customer not found" });
    return;
  }

  res.sendStatus(204);
});

export default router;
