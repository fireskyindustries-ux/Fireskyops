import { Router, type IRouter } from "express";
import healthRouter from "./health";
import customersRouter from "./customers";
import enquiriesRouter from "./enquiries";
import inspectionsRouter from "./inspections";
import jobsRouter from "./jobs";
import dashboardRouter from "./dashboard";
import skyRouter from "./sky";

const router: IRouter = Router();

router.use(healthRouter);
router.use(dashboardRouter);
router.use(customersRouter);
router.use(enquiriesRouter);
router.use(inspectionsRouter);
router.use(jobsRouter);
router.use(skyRouter);

export default router;
