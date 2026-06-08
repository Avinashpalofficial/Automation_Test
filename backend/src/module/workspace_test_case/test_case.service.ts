import { supabase } from "../../config/supabase";
import crypto from "crypto";
import {
  generateExecutionId,
  generateTestCaseId,
} from "../../utils/generate-id";

import axios from "axios";
interface TestStep {
  action: string;
  selector?: string;
  value?: string;
}
interface CreateTestCaseInput {
  workspaceId: string;
  suiteId: string | null;
  name: string;
  description?: string;
  targetUrl?: string;
  steps: TestStep[];
  createdBy: string;
}

interface RunTestCaseInput {
  testCaseId: string;
  createdBy: string;
}

export async function createTestCaseService({
  workspaceId,
  suiteId,
  name,
  description,
  targetUrl,
  steps,
  createdBy,
}: CreateTestCaseInput) {
  /** check membership */
  console.log(workspaceId);

  const { data: membership, error: membershipError } = await supabase
    .from("workspace_members")
    .select("*")
    .eq("workspace_id", workspaceId)
    .eq("user_id", createdBy)
    .single();
  if (membershipError || !membership) {
    console.error("Membership check error:", membershipError);
    throw new Error("Access denied");
  }
  console.log(membership);

  /** Verify suite belongs to workspace*/

  const { data: suite, error: suiteError } = await supabase
    .from("suites")
    .select("*")
    .eq("id", suiteId)
    .eq("workspace_id", workspaceId)
    .maybeSingle();
  if (suiteError || !suite) {
    console.error("Suite verification error:", suiteError);
    throw new Error("Invalid test suite");
  }

  /** Generate step hash */
  const stepHash = crypto
    .createHash("sha256")
    .update(JSON.stringify(steps))
    .digest("hex");

  /** Insert test case */
  const { data: testCase, error: testCaseError } = await supabase
    .from("test_cases")
    .insert({
      id: generateTestCaseId(),
      workspace_id: workspaceId,
      suite_id: suiteId,
      name,
      description,
      target_url: targetUrl,
      steps,
      steps_hash: stepHash,
      created_by: createdBy,
    })
    .select()
    .single();

  if (testCaseError) {
    console.error("Error creating test case:", testCaseError);
    throw new Error("Failed to create test case");
  }
  return testCase;
}

export async function runTestCaseService({
  testCaseId,
  createdBy: userId,
}: RunTestCaseInput) {
  /** fetch test case */
  const { data: testCase, error: testCaseError } = await supabase
    .from("test_cases")
    .select("*")
    .eq("id", testCaseId)
    .single();

  if (testCaseError || !testCase) {
    console.error("Error fetching test case:", testCaseError);
    throw new Error("Test case not found");
  }
  /** check membership */
  const { data: membership, error: membershipError } = await supabase
    .from("workspace_members")
    .select("*")
    .eq("workspace_id", testCase.workspace_id)
    .eq("user_id", userId)
    .single();
  if (membershipError || !membership) {
    console.error("Membership check error:", membershipError);
    throw new Error("Access denied");
  }
  /* Create job reference
    (Manager DB only)  */

  const { data: job, error: jobError } = await supabase
    .from("job_refs")
    .insert({
      job_id: generateExecutionId(),
      testcase_id: testCaseId,
      workspace_id: testCase.workspace_id,
      suite_id: testCase.suite_id,
      triggered_by: userId,
      runner_type: "playwright",
      last_known_status: "queued",
    })
    .select()
    .single();
  if (jobError || !job) {
    console.error("Error creating job reference:", jobError);
    throw new Error("Failed to create job reference");
  }
  //call the runner backend to execute the test case
  console.log("suite_id:", testCase.suite_id);

  await axios.post(
    "http://localhost:4000/jobs",
    {
      workspace_id: testCase.workspace_id,
      suite_id: testCase.suite_id,
      jobId: job.job_id,
      testCaseId: testCase.id,
      triggered_by: userId,
      steps: testCase.steps,
      targetUrl: testCase.target_url,
      description: testCase.description,
      steps_hash: testCase.steps_hash,
    },
    {
      headers: {
        "Idempotency-Key": job.job_id,
      },
    },
  );

  return {
    jobId: job.job_id,
    status: "queued",
  };
}
