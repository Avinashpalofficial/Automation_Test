import { StepsSchema, TestStep } from "@automation/shared";
import { StepExecutionRow } from "./execution.types";
import { StepStatus } from "./execution.types";
import { runnerSupabaseClient } from "../../config/supabase";
import { finished } from "node:stream";
const TABLE = "step_executions";
export async function fanOutSteps(
  jobId: string,
  steps: unknown,
  attemptId: string | null,
): Promise<StepExecutionRow[]> {
  const parsed: TestStep[] = StepsSchema.parse(steps);
  const rows = parsed.map((s, i) => ({
    job_id: jobId,
    attempt_id: attemptId,
    step_index: i,
    action: s.action,
    description: s.description ?? null,
    target_hint: s.targetHint ?? null,
    value_token: s.value ?? null, // Manager already tokenizes secrets as {{secret.x}}
    variable_name: s.variableName ?? null,
    retry_count: s.retryCount ?? 0,
    status: "pending" as StepStatus,
  }));

  const { data, error } = await runnerSupabaseClient
    .from(TABLE)
    .insert(rows)
    .select();
  if (error) {
    console.error("fanoutstep faild", error);
    throw new Error("Failed to fan out step_execution");
  }
  return (data ?? []) as StepExecutionRow[];
}

/**Load all steps for a job in execution order */

export async function getStepForJob(
  jobId: string,
): Promise<StepExecutionRow[]> {
  const { data, error } = await runnerSupabaseClient
    .from(TABLE)
    .select("*")
    .eq("job_id", jobId)
    .order("step_index", { ascending: true });
  if (error) {
    console.error("getsetpforjob failed", error);
    throw new Error("failed to load step_execution_order");
  }
  return (data ??
    []) as StepExecutionRow[]; /**?? mean of  'Agar left side ki value null ya undefined hai, to right side ki value use karo.' */
}

/** mark step running means that test cases is under running */
export async function markStepRunning(id: string): Promise<void> {
  const { error } = await runnerSupabaseClient
    .from(TABLE)
    .update({ status: "running", started_at: new Date().toISOString() })
    .eq("id", id);
  if (error) throw new Error("Failed to mark step running");
}

/**mark_step_finished -> execution complete hone ke bad kya hua  */

export async function markStepFinished(
  id: string,
  status: Extract<StepStatus, "passed" | "failed" | "skipped" | "blocked">,
  opts: {
    errorSummary?: string;
    blockReason?: string;
    resolveSelector?: string;
  },
): Promise<void> {
  const { error } = await runnerSupabaseClient
    .from(TABLE)
    .update({
      status,
      finished_at: new Date().toISOString(),
      error_summary: opts.errorSummary ?? null,
      block_reason: opts.blockReason ?? null,
      resolve_selector: opts.resolveSelector ?? null,
      ...(opts.resolveSelector
        ? { resolve_selector: opts.resolveSelector }
        : {}),
    })
    .eq("id", id);
  if (error) throw new Error("Failed to mark step finished");
}
