import { analyzePage } from "../page-analyzer.service";
import { generateTestCase } from "../ai_planner/ai_planner.service";
import { createTestCaseService } from "../../workspace_test_case/test_case.service";
import { runTestCaseService } from "../../workspace_test_case/test_case.service";
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
  const pageData = await analyzePage(url);

  const generated = await generateTestCase(prompt, pageData);
  console.log("workspaceId:", workspaceId);
  console.log("createdBy:", createdBy);
  const testCase = await createTestCaseService({
    workspaceId,
    suiteId,
    name: prompt,
    description: prompt,
    targetUrl: generated.target_url,
    steps: generated.steps,
    createdBy,
  });

  const execution = await runTestCaseService({
    testCaseId: testCase.id,
    createdBy,
  });

  return {
    testCase,
    execution,
  };
}
