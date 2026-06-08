import { request, response } from "express";
import { generateAiTestCaseService } from "./ai_generate_test_case.service";
export async function generateAiTestCaseController(
  req: typeof request,
  res: typeof response,
) {
  try {
    console.log("CONTROLLER HIT");

    const result = await generateAiTestCaseService({
      ...req.body,
      createdBy: req.user!.id,
    });

    console.log("SERVICE COMPLETED");

    return res.json({
      success: true,
      data: result,
    });
  } catch (error) {
    console.error("CONTROLLER ERROR:", error);

    return res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }
}
