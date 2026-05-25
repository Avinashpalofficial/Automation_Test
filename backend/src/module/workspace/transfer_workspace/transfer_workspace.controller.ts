import { Request, Response } from "express";
import { transferWorkspaceService } from "./transfer_workspace.service";

export async function transferWorkspaceController(req: Request, res: Response) {
  try {
    const { targetUserId } = req.body;
    const workspaceId = req.params.id as string;
    const currentOwnerId = req.user!.id;

    /**calling service layer */
    const result = await transferWorkspaceService({
      workspaceId,
      currentOwnerId,
      targetUserId,
    });
    return res.status(200).json({
      success: true,
      message: "Ownership transfer successfully",
      data: result,
    });
  } catch (error) {
    console.error("TRANSFER WORKSPACE CONTROLLER ERROR:", error);
    return res.status(500).json({
      success: false,
      message: error instanceof Error ? error.message : "Internal server error",
    });
  }
}
