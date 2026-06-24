// runner_backend/src/module/job/job_service.ts
import { runnerSupabaseClient } from "../../config/supabase";
import { jobQueue } from "../../queue/job.queue";
import { fanOutSteps } from "../execution/step_execution";

interface submitJobInput {
  payload: any;
  idempotencyKey: string;
}

export async function submitJobService({
  payload,
  idempotencyKey,
}: submitJobInput) {
  // ─── (1) REAL IDEMPOTENCY ───────────────────────────────────────────
  // Same Idempotency-Key replay → return the ORIGINAL job. Don't insert,
  // don't fan out, don't re-enqueue. (Previously a duplicate threw a 500.)
  const { data: existing } = await runnerSupabaseClient
    .from("jobs")
    .select("id, status")
    .eq("workspace_id", payload.workspace_id)
    .eq("idempotency_key", idempotencyKey)
    .maybeSingle();

  if (existing) {
    console.log("Idempotent replay — returning existing job:", existing.id);
    return { jobId: existing.id, status: existing.status };
  }

  // ─── Insert the job row (existing behaviour) ────────────────────────
  const { data: job, error: jobError } = await runnerSupabaseClient
    .from("jobs")
    .insert({
      id: payload.jobId,
      workspace_id: payload.workspace_id,
      testcase_id: payload.testCaseId,
      suite_id: payload.suite_id,
      triggered_by: payload.triggered_by,

      // ─── (2) RESPECT INCOMING runner_type ─────────────────────────
      // AI path can send "ai_playwright"; legacy path omits it → defaults
      // to "playwright" so nothing breaks.
      runner_type: payload.runner_type ?? "playwright",

      target_url: payload.targetUrl,
      description: payload.description,
      steps: payload.steps,
      steps_hash: payload.steps_hash,
      requirements: {},
      idempotency_key: idempotencyKey,
      webhook_url: process.env.WEBHOOK_URL,
      status: "queued",
    })
    .select()
    .single();

  if (jobError || !job) {
    console.error("Error inserting job:", jobError);
    throw new Error("Failed to submit job");
  }

  // ─── (3) FAN-OUT — explode steps into per-step step_executions rows ──
  // This is the call that makes the new AI tables come alive.
  // GUARDED: fanOutSteps() runs StepsSchema.parse() inside.
  //   • structured TestStep[] (AI plan-graph path) → rows created, status 'pending'
  //   • legacy string[] path → parse() throws → we LOG + CONTINUE, so the
  //     existing job-submit flow is never broken by this addition.
  try {
    const stepRows = await fanOutSteps(payload.jobId, payload.steps, null);
    console.log(
      `Fanned out ${stepRows.length} step_executions for ${payload.jobId}`,
    );
  } catch (err) {
    console.warn(
      `fanOutSteps skipped for ${payload.jobId} (likely legacy string[] steps):`,
      err instanceof Error ? err.message : err,
    );
  }

  await jobQueue.add("run-test", payload);
  console.log("job received");
  return { jobId: payload.jobId, status: "queued" };
}

export async function getRunnerJob(jobId: string) {
  const { data: job, error } = await runnerSupabaseClient
    .from("jobs")
    .select("*")
    .eq("id", jobId)
    .single();

  if (error || !job) {
    throw new Error("Runner job not found");
  }
  return job;
}

export async function updateRunnerJobStatus(
  jobId: string,
  status: string,
  errorSummary?: string,
) {
  const updateData: any = {
    status,
    error_summary: errorSummary ?? null,
  };

  // set finish time when completed
  if (status === "passed" || status === "failed") {
    updateData.finished_at = new Date().toISOString();
  }

  const { error } = await runnerSupabaseClient
    .from("jobs")
    .update(updateData)
    .eq("id", jobId);

  if (error) {
    console.error(error);
    throw new Error("Failed to update job status");
  }
}
