import { Request, Response } from "express";
import { updateWorksapceService } from "./update_workspace.service";
import { success } from "zod";

export async function updateWorkspaceController(req: Request, res: Response) {
  try {
    const { name, repo } = req.body;
    const workspaceId = req.params.id as string;
    const userId = req.user!.id;
    /**calling service layer */
    const updateWorkspace = await updateWorksapceService({
      name,
      repo,
      workspaceId,
      userId,
    });

    return res.status(200).json({
      success: true,
      message: "workspace updated successfully",
      data: updateWorkspace,
    });
  } catch (error: any) {
    console.error("UPDATE WORKSPACE CONTROLLER ERROR", error);
    return res.status(500).json({
      success: false,
      message: error instanceof Error ? error.message : "Internal server error",
    });
  }
}
