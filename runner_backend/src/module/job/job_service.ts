import { runnerSupabaseClient } from "../../config/supabase";
import { jobQueue } from "../../queue/job.queue";
interface submitJobInput {
  payload: any;
  idempotencyKey: string;
}

export async function submitJobService({
  payload,
  idempotencyKey,
}: submitJobInput) {
  /** payload received  by manager backend*/
  const jobData = {
    jobId: payload.jobId,
    status: "queued",
  };
  /** Insert job into database with status 'queued' */
  console.log(process.env.webhook_url);
  console.log(process.env.RUNNER_SUPABASE_URL);
  console.log(process.env.RUNNER_SUPABASE_ANON_KEY);
  // console.log("suite_id:", payload.suite);

  const { data: job, error: jobError } = await runnerSupabaseClient
    .from("jobs")
    .insert({
      id: payload.jobId,
      workspace_id: payload.workspace_id,
      testcase_id: payload.testCaseId,
      suite_id: payload.suite_id,
      triggered_by: payload.triggered_by,
      runner_type: "playwright",

      target_url: payload.targetUrl,
      description: payload.description,

      steps: payload.steps,

      steps_hash: payload.steps_hash,

      requirements: {},

      idempotency_key: payload.jobId,

      webhook_url: process.env.WEBHOOK_URL,

      status: "queued",
    })
    .select()
    .single();
  if (jobError || !job) {
    console.error("Error inserting job:", jobError);
    throw new Error("Failed to submit job");
  }

  await jobQueue.add("run-test", payload);
  console.log("job received");
  return jobData;
}

export async function getRunnerJob(jobId: string) {
  const { data: job, error } = await runnerSupabaseClient
    .from("jobs")
    .select("*")
    .eq("id", jobId)
    .single();
  console.log(jobId);
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
  const { error } = await runnerSupabaseClient

    .from("jobs")

    .update({
      status,

      error_summary: errorSummary || null,
    })

    .eq("id", jobId);

  if (error) {
    console.error(error);

    throw new Error("Failed to update job status");
  }
}
