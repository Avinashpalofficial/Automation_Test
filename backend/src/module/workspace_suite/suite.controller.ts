import { Request, Response } from "express";
import { createSuiteService } from "./suite.service";

export async function createSuiteController(req: Request, res: Response) {
  try {
    const workspaceId = req.params.workspaceId as string;
    const { name, description, repo } = req.body;
    const createdBy = req.user!.id;

    if (!name) {
      return res.status(400).json({
        success: false,
        message: "Suite name is required",
      });
    }
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: "Unauthorized",
      });
    }
    // Call the service function to create a suite
    const result = await createSuiteService({
      workspaceId,
      name,
      description,
      repo,
      createdBy,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Failed to create suite",
    });
  }
}
