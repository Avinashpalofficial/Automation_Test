import express from "express";
import { authenticate } from "../middleware/auth.middleware";
import {
  acceptInviteController,
  inviteMemberController,
} from "../module/workspace_Invite_Member/workspace.controller";
import { deleteInviteMemberController } from "../module/workspace_Invite_Member/delete_invite.controller";
const workspaceInviteRouter = express.Router();

workspaceInviteRouter.post("/:id/invite", authenticate, inviteMemberController);
export default workspaceInviteRouter;

workspaceInviteRouter.post(
  "/accept/:token",
  authenticate,
  acceptInviteController,
);

workspaceInviteRouter.delete(
  "/:id/invites/:inviteId",
  authenticate,
  deleteInviteMemberController,
);
