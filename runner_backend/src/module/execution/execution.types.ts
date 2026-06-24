// runner_backend/src/module/execution/execution.types.ts
// Row + enum types for the AI execution-state layer.
// snake_case fields mirror the DB exactly (DB is the source of truth).
// StepAction is imported from @automation/shared so the action vocabulary
// stays single-sourced with the Zod StepSchema.
import { StepAction } from "@automation/shared";
export type StepStatus =
  | "pending"
  | "running"
  | "passed"
  | "failed"
  | "skipped"
  | "blocked";

export type BlockReason =
  | "captcha"
  | "payment_iframe"
  | "cross_origin"
  | "bot_detection"
  | "timeout"
  | "unknown";

export type AiTier = "plan" | "assert" | "heal";
export type AiProvider = "gemini" | "groq";
export type InvocationStatus = "ok" | "timeout" | "error" | "fallback";
export type DispatchResult = "ok" | "fail" | "skipped";

export interface StepExecutionRow {
  id: string;
  job_id: string;
  attempt_id: string | null;
  step_index: number;
  action: StepAction;
  description: string | null;
  target_hint: string | null;
  value_token: string | null;
  variable_name: string | null;
  status: StepStatus;
  block_reason: BlockReason | null;
  retry_count: number;
  resolved_selector: string | null;
  attempts_count: number;
  tokens_total: number;
  cost_usd: number; // Supabase returns numeric as string in some cases — coerce with Number() when arithmetic is needed
  started_at: string | null;
  finished_at: string | null;
  error_summary: string | null;
  created_at: string;
}

export interface ActionAttemptRow {
  id: string;
  step_execution_id: string;
  attempt_no: number;
  tier: AiTier;
  planned_action: unknown | null;
  dispatch_result: DispatchResult | null;
  error: unknown | null;
  latency_ms: number | null;
  created_at: string;
}

export interface AiInvocationRow {
  id: string;
  job_id: string;
  step_execution_id: string | null;
  action_attempt_id: string | null;
  tier: AiTier;
  provider: AiProvider;
  model: string;
  tokens_in: number;
  tokens_out: number;
  cost_usd: number;
  latency_ms: number | null;
  status: InvocationStatus;
  prompt_hash: string | null;
  created_at: string;
}
