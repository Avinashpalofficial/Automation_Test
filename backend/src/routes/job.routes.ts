import { Router } from "express";

import { updateJobStatusController } from "../module/job/job.controller";
const jobRouter = Router();

/*
  INTERNAL WEBHOOK
*/
jobRouter.post("/internal/jobs/status", updateJobStatusController);
export default jobRouter;
