import express from "express";
import { authenticate } from "../middleware/auth.middleware";
import { createWorkspaceController } from "../module/workspace/workspace.controller";
import { validate } from "../middleware/validate.middlewate";
import {
  deleteWorkspaceSchema,
  transferWorkspaceSchema,
  updateWorkspaceSchema,
  workspaceSchema,
} from "../validation/validation";
import { getWorkspacesController } from "../module/workspace/get-workspace/get-workspace.controller";
import { getWorkspacesDetailController } from "../module/workspace/get-workspace/get-workspace.controller";
import { deleteWorkspaceController } from "../module/workspace/delete-workspace/delete_workspace.controller";
import { transferWorkspaceController } from "../module/workspace/transfer_workspace/transfer_workspace.controller";
const workspaceRouter = express.Router();

workspaceRouter.post(
  "/",
  authenticate,
  validate(workspaceSchema),
  createWorkspaceController,
);

workspaceRouter.get("/", authenticate, getWorkspacesController);
workspaceRouter.get("/:id", authenticate, getWorkspacesDetailController);
workspaceRouter.patch(
  "/:id",
  authenticate,
  validate(updateWorkspaceSchema),
  getWorkspacesDetailController,
);
workspaceRouter.delete(
  "/:id",
  authenticate,
  validate(deleteWorkspaceSchema),
  deleteWorkspaceController,
);
workspaceRouter.post(
  "/:id/transfer",
  authenticate,
  validate(transferWorkspaceSchema),
  transferWorkspaceController,
);
export default workspaceRouter;
