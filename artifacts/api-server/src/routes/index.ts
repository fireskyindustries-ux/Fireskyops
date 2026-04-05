import { Router, type IRouter } from "express";
import { requireAuth } from "../middlewares/requireAuth";
import healthRouter from "./health";
import trackRouter from "./track";
import customersRouter from "./customers";
import enquiriesRouter from "./enquiries";
import inspectionsRouter from "./inspections";
import jobsRouter from "./jobs";
import appointmentsRouter from "./appointments";
import dashboardRouter from "./dashboard";
import skyRouter from "./sky";
import usersRouter from "./users";
import notificationsRouter from "./notifications";

const router: IRouter = Router();

router.use(healthRouter);

// Public routes (no auth)
router.use(trackRouter);

// All routes below require authentication
router.use(requireAuth);

router.use(dashboardRouter);
router.use(customersRouter);
router.use(enquiriesRouter);
router.use(inspectionsRouter);
router.use(jobsRouter);
router.use(appointmentsRouter);
router.use(skyRouter);
router.use(usersRouter);
router.use(notificationsRouter);

export default router;
