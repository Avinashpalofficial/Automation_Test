import express from "express";
import { authenticate } from "../middleware/auth.middleware";
import { createWorkspaceController } from "../module/workspace/workspace.controller";
const workspaceRouter = express.Router();

workspaceRouter.post("/", authenticate, createWorkspaceController);
export default workspaceRouter;
