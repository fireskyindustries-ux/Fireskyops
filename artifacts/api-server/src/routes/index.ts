import { Router, type IRouter } from "express";
import { requireAuth } from "../middlewares/requireAuth";
import { getAuth } from "@clerk/express";
import healthRouter from "./health";
import trackRouter from "./track";
import storageRouter from "./storage";
import quotePublicRouter from "./quote_public";
import fireVisionRouter from "./firevision";
import processLeadRouter from "./process-lead";
import publicEnquiryRouter from "./public-enquiry";
import customersRouter from "./customers";
import enquiriesRouter from "./enquiries";
import inspectionsRouter from "./inspections";
import jobsRouter from "./jobs";
import jobLoadsRouter from "./job_loads";
import quotesRouter from "./quotes";
import appointmentsRouter from "./appointments";
import dashboardRouter from "./dashboard";
import skyRouter from "./sky";
import usersRouter from "./users";
import notificationsRouter from "./notifications";
import pushRouter from "./push";
import websiteRouter from "./website";
import emailLogsRouter from "./email_logs";
import exportRouter from "./export";
import branchesRouter from "./branches";
import stockRouter from "./stock";
import analyticsRouter from "./analytics";
import skyVisionRouter from "./sky-vision";
import adminTanksRouter from "./admin-tanks";

const router: IRouter = Router();

router.use(healthRouter);

// Temporary auth debug — remove once production auth issue is resolved
router.get("/api/auth/debug", requireAuth, (req, res) => {
  const auth = getAuth(req);
  res.json({
    userId: (req as any).userId,
    userRole: (req as any).userRole,
    userBranchId: (req as any).userBranchId,
    sessionClaims: auth?.sessionClaims ?? null,
  });
});

// Public routes (no auth)
router.use(trackRouter);
router.use(storageRouter);
router.use(quotePublicRouter);
router.use(fireVisionRouter);
router.use(processLeadRouter);
router.use(publicEnquiryRouter);

// All routes below require authentication
router.use(requireAuth);

router.use(dashboardRouter);
router.use(customersRouter);
router.use(enquiriesRouter);
router.use(inspectionsRouter);
router.use(jobsRouter);
router.use(jobLoadsRouter);
router.use(quotesRouter);
router.use(appointmentsRouter);
router.use(skyRouter);
router.use(usersRouter);
router.use(notificationsRouter);
router.use(pushRouter);
router.use(websiteRouter);
router.use(emailLogsRouter);
router.use(exportRouter);
router.use("/branches", branchesRouter);
router.use("/stock", stockRouter);
router.use(analyticsRouter);
router.use(skyVisionRouter);
router.use(adminTanksRouter);

export default router;
