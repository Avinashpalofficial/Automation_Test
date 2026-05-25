import { Request, Response } from "express";
import { deleteInviteMemberService } from "./delete_invite_member/delete_invite.service";
export async function deleteInviteMemberController(
  req: Request,
  res: Response,
) {
  try {
    const workspaceId = req.params.id as string;
    const inviteId = req.params.inviteId as string;
    const userId = req.user!.id;
    console.log("INVITE:", inviteId);
    console.log("workspaceId:", workspaceId);

    /**calling service layer */
    const result = await deleteInviteMemberService({
      workspaceId,
      inviteId,
      userId,
    });
    return res.status(200).json({
      success: true,
      message: "InviteId deleted successfully",
      result,
    });
  } catch (error: unknown) {
    return res.status(500).json({
      success: false,
      message: error instanceof Error ? error.message : "Internal server error",
    });
  }
}
