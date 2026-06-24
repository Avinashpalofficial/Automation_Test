import { createTestCaseService } from "../../workspace_test_case/test_case.service";
import { runTestCaseService } from "../../workspace_test_case/test_case.service";
import { IntentParser } from "../intent_parser/intent_parser.service";
import { buildPlanGraph } from "../plan_graph/plan_graph.service";
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
  const intentParser = new IntentParser();
  const intent = await intentParser.parse(prompt, url);
  const planner = buildPlanGraph(intent);
  console.log("workspaceId:", workspaceId);
  console.log("createdBy:", createdBy);
  const testCase = await createTestCaseService({
    workspaceId,
    suiteId,
    name: prompt,
    description: intent.summary || prompt,
    targetUrl: url,
    steps: planner.steps,
    createdBy,
  });

  const execution = await runTestCaseService({
    testCaseId: testCase.id,
    createdBy,
  });

  return {
    testCase,
    execution,
    plan: {
      requiresAuth: planner.requiresAuth,
      confidence: planner.confidence,
      requiredSecrets: planner.requiredSecrets,
      warnings: planner.warnings,
    },
  };
}
