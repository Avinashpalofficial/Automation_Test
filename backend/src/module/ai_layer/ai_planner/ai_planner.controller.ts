// import { Request, Response } from "express";

// import { analyzePageDeep } from "../page_analyzer/spa-page-analyzer.service";
// import { AITestPlanner } from "../ai_planner/ai_planner.service";

// export async function aiGenerateController(req: Request, res: Response) {
//   const { prompt, url } = req.body;

//   const pageData = await analyzePageDeep(url);
//   const planner = new AITestPlanner();
//   const testCase = await planner.generateTestCase(prompt, pageData);
//   console.log("PROMPT:", prompt);
//   console.log("PAGE DATA:", pageData);
//   res.json(testCase);
// }
