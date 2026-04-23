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
    accessNotes: c.accessNotes ?? undefined,
    notes: c.notes ?? undefined,
  };
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
  const [customer] = await db.insert(customersTable).values({ ...parsed.data, branchId }).returning();
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

  const [customer] = await db
    .update(customersTable)
    .set({ ...parsed.data, updatedAt: new Date() })
    .where(eq(customersTable.id, params.data.id))
    .returning();

  if (!customer) {
    res.status(404).json({ error: "Customer not found" });
    return;
  }

  res.json(UpdateCustomerResponse.parse(normalizeCustomer(customer)));
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
