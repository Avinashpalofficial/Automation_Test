import express from "express";
import { submitJobController } from "../module/job/job.controller";

const jobRouter = express.Router();
jobRouter.post("/", submitJobController);
export default jobRouter;
