import { Request, Response } from "express";
import {
  getWorkspaceDetailService,
  getWorkspacesService,
} from "../get-workspace/get-workspace.service";

export async function getWorkspacesController(req: Request, res: Response) {
  try {
    const userId = req.user!.id;

    const workspaces = await getWorkspacesService(userId);

    return res.status(200).json({
      success: true,
      data: workspaces,
    });
  } catch (error) {
    console.error("GET WORKSPACES CONTROLLER ERROR:", error);

    return res.status(500).json({
      success: false,
      message: error instanceof Error ? error.message : "Internal server error",
    });
  }
}

/**  Get all workspaces details */

export async function getWorkspacesDetailController(
  req: Request,
  res: Response,
) {
  try {
    const workspaceId = req.params.id as string;
    const userId = req.user!.id;
    console.log("PARAMS:", req.params);
    console.log("workspaceId:", req.params.id);
    console.log("userId:", req.user?.id);

    const workspaces = await getWorkspaceDetailService({
      workspaceId,
      userId,
    });

    return res.status(200).json({
      success: true,
      data: workspaces,
    });
  } catch (error) {
    console.error("GET WORKSPACES CONTROLLER ERROR:", error);

    return res.status(500).json({
      success: false,
      message: error instanceof Error ? error.message : "Internal server error",
    });
  }
}
