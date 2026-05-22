import { request, response } from "express";
import { createTestCaseService, runTestCaseService } from "./test_case.service";

export async function createTestCaseController(
  req: typeof request,
  res: typeof response,
) {
  try {
    const createdBy = req.user!.id;
    const { workspaceId, suiteId, name, description, targetUrl, steps } =
      req.body;

    if (!workspaceId) {
      return res.status(400).json({
        success: false,
        message: "Workspace ID is required",
      });
    }
    if (!suiteId) {
      return res.status(400).json({
        success: false,
        message: "Suite ID is required",
      });
    }
    if (!name) {
      return res.status(400).json({
        success: false,
        message: "Test case name is required",
      });
    }
    const result = await createTestCaseService({
      workspaceId,
      suiteId,
      name,
      description,
      targetUrl,
      steps,
      createdBy,
    });

    return res.status(201).json({
      success: true,
      message: "Test case created successfully",
      data: result,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
}

export async function runTestCaseController(
  req: typeof request,
  res: typeof response,
) {
  try {
    const createdBy = req.user!.id;
    const { testCaseId } = req.params as { testCaseId: string };
    if (!createdBy) {
      return res.status(401).json({
        success: false,
        message: "Unauthorized",
      });
    }
    const result = await runTestCaseService({
      testCaseId,
      createdBy,
    });
    return res.status(201).json({
      success: true,
      message: "Test case execution started",
      data: result,
    });
  } catch (error) {
    console.log(error);

    return res.status(500).json({
      success: false,
      message: error instanceof Error ? error.message : "Internal server error",
    });
  }
}
