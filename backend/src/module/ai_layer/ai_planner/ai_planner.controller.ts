import { Request, Response } from "express";

import { analyzePage } from "../../ai_layer/page-analyzer.service";
import { generateTestCase } from "../ai_planner/ai_planner.service";

export async function aiGenerateController(req: Request, res: Response) {
  const { prompt, url } = req.body;

  const pageData = await analyzePage(url);

  const testCase = await generateTestCase(prompt, pageData);
  console.log("PROMPT:", prompt);
  console.log("PAGE DATA:", pageData);
  res.json(testCase);
}
