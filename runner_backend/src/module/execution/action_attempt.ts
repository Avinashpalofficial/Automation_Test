// Repository for action_attempts — each plan→dispatch cycle within a step,
// including self-heal re-plans. Distinct from job_attempts (infra retries).

import { runnerSupabaseClient } from "../../config/supabase";
import type {
  ActionAttemptRow,
  AiTier,
  DispatchResult,
} from "./execution.types";

const TABLE = "action_attempts";

/** Next 1-based attempt number for a step. */
export async function nextAttemptNo(stepExecutionId: string): Promise<number> {
  const { data, error } = await runnerSupabaseClient
    .from(TABLE)
    .select("attempt_no")
    .eq("step_execution_id", stepExecutionId)
    .order("attempt_no", { ascending: false })
    .limit(1);

  if (error) {
    console.error("nextAttemptNo failed:", error);
    throw new Error("Failed to read attempt_no");
  }
  const last = (data?.[0]?.attempt_no as number | undefined) ?? 0;
  return last + 1;
}

export async function createActionAttempt(input: {
  stepExecutionId: string;
  tier?: AiTier; // 'plan' (default) | 'heal'
  plannedAction?: unknown; // { action, selector, args }
  dispatchResult?: DispatchResult;
  error?: unknown; // { code, message, stack }
  latencyMs?: number;
}): Promise<ActionAttemptRow> {
  const attempt_no = await nextAttemptNo(input.stepExecutionId);

  const { data, error } = await runnerSupabaseClient
    .from(TABLE)
    .insert({
      step_execution_id: input.stepExecutionId,
      attempt_no,
      tier: input.tier ?? "plan",
      planned_action: input.plannedAction ?? null,
      dispatch_result: input.dispatchResult ?? null,
      error: input.error ?? null,
      latency_ms: input.latencyMs ?? null,
    })
    .select()
    .single();

  if (error || !data) {
    console.error("createActionAttempt failed:", error);
    throw new Error("Failed to create action_attempt");
  }
  return data as ActionAttemptRow;
}

/** Patch the outcome of an attempt after dispatch completes. */
export async function finalizeActionAttempt(
  id: string,
  patch: {
    dispatchResult: DispatchResult;
    plannedAction?: unknown;
    error?: unknown;
    latencyMs?: number;
  },
): Promise<void> {
  const { error } = await runnerSupabaseClient
    .from(TABLE)
    .update({
      dispatch_result: patch.dispatchResult,
      ...(patch.plannedAction !== undefined
        ? { planned_action: patch.plannedAction }
        : {}),
      ...(patch.error !== undefined ? { error: patch.error } : {}),
      ...(patch.latencyMs !== undefined ? { latency_ms: patch.latencyMs } : {}),
    })
    .eq("id", id);
  if (error) throw new Error("Failed to finalize action_attempt");
}
