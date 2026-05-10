import { Router } from "express";
import { requirePortalAuth, getPortalUser } from "../middlewares/requirePortalAuth";

const router = Router();

// GET /api/portal/auth/me — return the current portal user profile (Clerk-authenticated)
router.get("/auth/me", requirePortalAuth, (req, res) => {
  res.json(getPortalUser(req));
});

export default router;
