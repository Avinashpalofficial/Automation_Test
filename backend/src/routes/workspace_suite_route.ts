import express from "express";
import { createSuiteController } from "../module/workspace_suite/suite.controller";
import { authenticate } from "../middleware/auth.middleware";
const sutiesRouter = express.Router({ mergeParams: true });

sutiesRouter.post("/:workspaceId/suites", authenticate, createSuiteController);
export default sutiesRouter;
