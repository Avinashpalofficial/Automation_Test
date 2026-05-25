import { Request, Response } from "express";
import { deleteWorkspaceService } from "./delete_workspace.service";

export async function deleteWorkspaceController(req: Request, res: Response) {
  try {
    const { confirmName } = req.body;
    const workspaceId = req.params.id as string;
    const userId = req.user!.id;

    /**Call service */
    const result = await deleteWorkspaceService({
      confirmName,
      workspaceId,
      userId,
    });

    return res.status(200).json({
      success: true,
      message: "Workspace deleted successfully",
      data: result,
    });
  } catch (error: any) {
    console.error("DELETE WORKSPACE CONTROLLER ERROR", error);
    return res.status(500).json({
      success: false,
      message: error instanceof Error ? error.message : "Internal server error",
    });
  }
}
