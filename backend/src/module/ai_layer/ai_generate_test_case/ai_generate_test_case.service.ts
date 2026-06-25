import { createTestCaseService } from "../../workspace_test_case/test_case.service";
import { runTestCaseService } from "../../workspace_test_case/test_case.service";
import { AITestPlanner } from "../ai_planner/ai_planner.service";
// import { IntentParser } from "../intent_parser/intent_parser.service";
import { analyzePageDeep } from "../page_analyzer/spa-page-analyzer.service";
// import { buildPlanGraph } from "../plan_graph/plan_graph.service";
interface GenerateAiTestCaseInput {
  prompt: string;
  url: string;
  workspaceId: string;
  suiteId: string | null;
  createdBy: string;
}
export async function generateAiTestCaseService({
  prompt,
  url,
  workspaceId,
  suiteId,
  createdBy,
}: GenerateAiTestCaseInput) {
  const pageData = await analyzePageDeep(url);
  // const intent = await new IntentParser().parse(prompt, pageData.url);

  const planner = new AITestPlanner();
  const plan = await planner.generateTestCase(prompt, pageData);
  console.log("workspaceId:", workspaceId);
  console.log("createdBy:", createdBy);
  const testCase = await createTestCaseService({
    workspaceId,
    suiteId,
    name: prompt,
    description: plan.intent || prompt,
    targetUrl: url,
    steps: plan.steps,
    createdBy,
  });

  const execution = await runTestCaseService({
    testCaseId: testCase.id,
    createdBy,
    runnerType: "ai_playwright",
  });

  return {
    testCase,
    execution,
    plan: {
      requiresAuth: plan.requires_auth,
      confidence: plan.confidence,
    },
  };
}
