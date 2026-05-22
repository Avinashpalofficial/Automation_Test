import { inviteMemberService } from "./workspace.service";
import { acceptInviteService } from "./workspace.service";
import { Request, Response } from "express";

export async function inviteMemberController(req: Request, res: Response) {
  try {
    const workspaceId = req.params.id as string;

    const result = await inviteMemberService({
      workspaceId,
      email: req.body.email,
      role: req.body.role,
      invitedBy: req.user!.id,
      token: req.token!,
    });

    return res.status(201).json({
      success: true,
      message: "Invite sent successfully",
      data: result,
    });
  } catch (err) {
    return res.status(400).json({
      success: false,
      message: err instanceof Error ? err.message : "Internal server error",
    });
  }
}

export async function acceptInviteController(req: Request, res: Response) {
  try {
    const token = req.params.token as string;

    const userId = req.user?.id as string;
    const email = req.user?.email as string;

    const result = await acceptInviteService({
      token,
      userId,
      email,
    });

    return res.status(200).json({
      success: true,
      message: "Workspace joined successfully",
      data: result,
    });
  } catch (error: any) {
    return res.status(400).json({
      success: false,
      message: error.message,
    });
  }
}
