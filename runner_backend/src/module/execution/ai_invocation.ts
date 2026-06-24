// runner_backend/src/module/execution/ai_invocation.repository.ts
// Repository for ai_invocations — one row per LLM call. This is the cost /
// decision backbone: tier ('plan' | 'assert' | 'heal') lets you slice spend
// across the three AI tiers. job_id is denormalized for cheap per-run rollups.

import { runnerSupabaseClient } from "../../config/supabase";
import type {
  AiInvocationRow,
  AiTier,
  AiProvider,
  InvocationStatus,
} from "./execution.types";

const TABLE = "ai_invocations";

export async function recordInvocation(input: {
  jobId: string;
  stepExecutionId?: string;
  actionAttemptId?: string;
  tier: AiTier;
  provider: AiProvider;
  model: string;
  tokensIn?: number;
  tokensOut?: number;
  costUsd?: number;
  latencyMs?: number;
  status?: InvocationStatus;
  promptHash?: string;
}): Promise<AiInvocationRow> {
  const { data, error } = await runnerSupabaseClient
    .from(TABLE)
    .insert({
      job_id: input.jobId,
      step_execution_id: input.stepExecutionId ?? null,
      action_attempt_id: input.actionAttemptId ?? null,
      tier: input.tier,
      provider: input.provider,
      model: input.model,
      tokens_in: input.tokensIn ?? 0,
      tokens_out: input.tokensOut ?? 0,
      cost_usd: input.costUsd ?? 0,
      latency_ms: input.latencyMs ?? null,
      status: input.status ?? "ok",
      prompt_hash: input.promptHash ?? null,
    })
    .select()
    .single();

  if (error || !data) {
    console.error("recordInvocation failed:", error);
    throw new Error("Failed to record ai_invocation");
  }
  return data as AiInvocationRow;
}

/** Total cost (USD) for a job — handy for the Persist + Report step. */
export async function getJobCostUsd(jobId: string): Promise<number> {
  const { data, error } = await runnerSupabaseClient
    .from(TABLE)
    .select("cost_usd")
    .eq("job_id", jobId);

  if (error) throw new Error("Failed to read job cost");
  return (data ?? []).reduce(
    (sum, r: { cost_usd: number | string }) => sum + Number(r.cost_usd ?? 0),
    0,
  );
}
