import { StepsSchema, TestStep } from "@automation/shared";
import { StepExecutionRow } from "./execution.types";
import { StepStatus } from "./execution.types";
import { runnerSupabaseClient } from "../../config/supabase";
const TABLE = "step_executions";
/**
 * Fan out a job's plan-graph steps into per-step rows (status = 'pending').
 * Call this once at intake, right after the jobs row is inserted.
 *
 * `steps` MUST be the structured TestStep[] produced by the Manager plan_graph
 * (not legacy string[]). It is gated through StepsSchema here — this is the
 * boundary validation the shared contract expects the Runner to enforce.
 */
export async function fanOutSteps(
  jobId: string,
  steps: unknown,
  attemptId: string | null = null,
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

/**add_step_cost */

export async function addStepCost(
  id: string,
  tokens: number,
  costUsd: number,
): Promise<void> {
  const { data, error } = await runnerSupabaseClient
    .from(TABLE)
    .select("token_total,cost_usd,attempts_count")
    .eq("id", id)
    .single();
  if (!data || error) {
    throw new Error("Step not found for cost rollup");
  }
  const { error: upErr } = await runnerSupabaseClient
    .from(TABLE)
    .update({
      token_total: (data.token_total ?? 0) + tokens,
      cost_usd: (data.cost_usd ?? 0) + costUsd,
      attempts_count: data.attempts_count,
    })
    .eq("id", id);
  if (upErr) throw new Error("Failed to roll up step cost");
}
/**Increment attempts_count after creating an action_attempt */
export async function bumpAttemptsCount(id: string): Promise<void> {
  const { data, error } = await runnerSupabaseClient
    .from(TABLE)
    .select("attempts_count")
    .eq("id", id)
    .single();
  if (!data || error) {
    throw new Error("Step not found");
  }
  const { error: upErr } = await runnerSupabaseClient
    .from(TABLE)
    .update({ attempts_count: (data.attempts_count ?? 0) + 1 })
    .eq("id", id);
  if (upErr) throw new Error("Failed to bump attempts_count");
}

/**Increment retry_count on self heal */
export async function bumpRetryCount(id: string): Promise<void> {
  const { data, error } = await runnerSupabaseClient
    .from(TABLE)
    .select("retry_count")
    .eq("id", id)
    .single();
  if (!data || error) {
    throw new Error("Step not found");
  }
  const { error: upErr } = await runnerSupabaseClient
    .from(TABLE)
    .update({ retry_count: (data.retry_count ?? 0) + 1 })
    .eq("id", id);
  if (upErr) throw new Error("Failed to bump retry_count");
}
