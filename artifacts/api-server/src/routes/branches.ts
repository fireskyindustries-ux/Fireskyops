import { Router } from "express";
import { eq } from "drizzle-orm";
import { db, branchesTable } from "@workspace/db";
import { requireAdmin, requireBranchAdmin } from "../middlewares/requireAuth";

const router = Router();

// ─── Geocoding helper (Nominatim / OpenStreetMap — free, no API key) ─────────

async function geocodeAddress(query: string): Promise<{ lat: number; lng: number } | null> {
  try {
    const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(query)}&format=json&limit=1&countrycodes=za`;
    const res = await fetch(url, {
      headers: { "User-Agent": "FireskyFieldOps/1.0 (field-ops-management)" },
    });
    if (!res.ok) return null;
    const data = (await res.json()) as any[];
    if (data[0]?.lat && data[0]?.lon) {
      return { lat: parseFloat(data[0].lat), lng: parseFloat(data[0].lon) };
    }
  } catch {
    // Geocoding is best-effort — never block saving
  }
  return null;
}

function buildGeoQuery(address?: string | null, region?: string | null, name?: string | null): string | null {
  if (address?.trim()) return address.trim();
  if (region?.trim()) return region.trim() + ", South Africa";
  if (name?.trim()) return name.trim() + ", South Africa";
  return null;
}

// ─── Routes ───────────────────────────────────────────────────────────────────

// List all branches — any admin/branch_admin can view
router.get("/", requireBranchAdmin, async (req, res) => {
  try {
    const branches = await db.select().from(branchesTable).orderBy(branchesTable.name);
    res.json(branches);
  } catch (err) {
    console.error("branches GET /", err);
    res.status(500).json({ error: "Failed to fetch branches" });
  }
});

// Get single branch
router.get("/:id", requireBranchAdmin, async (req, res) => {
  const id = Number(req.params.id);
  try {
    const [branch] = await db.select().from(branchesTable).where(eq(branchesTable.id, id));
    if (!branch) { res.status(404).json({ error: "Not found" }); return; }
    res.json(branch);
  } catch (err) {
    console.error("branches GET /:id", err);
    res.status(500).json({ error: "Failed to fetch branch" });
  }
});

// Create branch — super admin only
router.post("/", requireAdmin, async (req, res): Promise<void> => {
  const { name, region, address, phone, email } = req.body;
  if (!name) { res.status(400).json({ error: "name is required" }); return; }
  try {
    const [branch] = await db.insert(branchesTable).values({ name, region, address, phone, email }).returning();

    // Geocode in the background — update coords if found
    const geoQuery = buildGeoQuery(address, region, name);
    if (geoQuery) {
      geocodeAddress(geoQuery).then(async (coords) => {
        if (coords) {
          await db.update(branchesTable).set({ lat: coords.lat, lng: coords.lng }).where(eq(branchesTable.id, branch.id));
        }
      }).catch(() => {});
    }

    res.status(201).json(branch);
  } catch (err) {
    console.error("branches POST /", err);
    res.status(500).json({ error: "Failed to create branch" });
  }
});

// Update branch — super admin only
router.patch("/:id", requireAdmin, async (req, res): Promise<void> => {
  const id = Number(req.params.id);
  const { name, region, address, phone, email } = req.body;
  try {
    const [branch] = await db
      .update(branchesTable)
      .set({ name, region, address, phone, email })
      .where(eq(branchesTable.id, id))
      .returning();
    if (!branch) { res.status(404).json({ error: "Not found" }); return; }

    // Re-geocode when address/region/name changes
    const geoQuery = buildGeoQuery(address, region, name);
    if (geoQuery) {
      geocodeAddress(geoQuery).then(async (coords) => {
        if (coords) {
          await db.update(branchesTable).set({ lat: coords.lat, lng: coords.lng }).where(eq(branchesTable.id, id));
        }
      }).catch(() => {});
    }

    res.json(branch);
  } catch (err) {
    console.error("branches PATCH /:id", err);
    res.status(500).json({ error: "Failed to update branch" });
  }
});

// Delete branch — super admin only
router.delete("/:id", requireAdmin, async (req, res) => {
  const id = Number(req.params.id);
  try {
    await db.delete(branchesTable).where(eq(branchesTable.id, id));
    res.json({ ok: true });
  } catch (err) {
    console.error("branches DELETE /:id", err);
    res.status(500).json({ error: "Failed to delete branch" });
  }
});

export default router;
