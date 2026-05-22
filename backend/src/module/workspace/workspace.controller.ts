import { createWorkspaceService } from "./workspace.service";
import { Request, Response } from "express";
export async function createWorkspaceController(req: Request, res: Response) {
  try {
    const userId = req.user?.id;

    const workspace = await createWorkspaceService({
      name: req.body.name,
      createdBy: req.user!.id,
    });

    return res.status(201).json({
      success: true,
      message: "Workspace created successfully",
      data: workspace,
    });
  } catch (err) {
    return res.status(400).json({
      success: false,
      message: err instanceof Error ? err.message : "Internal Server Error",
    });
  }
}
