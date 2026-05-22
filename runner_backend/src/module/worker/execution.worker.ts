import dotenv from "dotenv";
dotenv.config();
import { Worker } from "bullmq";

import { redisConnection } from "../../config/redis";

import { playwrightExecute } from "../playwright/execute";

const worker = new Worker(
  "execution-queue",

  async (job) => {
    console.log("JOB RECEIVED");

    console.log(job.data);

    /*
      extract jobId
    */

    const { jobId } = job.data;

    console.log("STARTING PLAYWRIGHT");

    /*
      execute playwright
    */

    await playwrightExecute(jobId);
  },

  {
    connection: redisConnection,
  },
);
console.log(process.env.RUNNER_SUPABASE_URL);
console.log(process.env.RUNNER_SUPABASE_ANON_KEY);

worker.on("completed", () => {
  console.log("JOB COMPLETED");
});

worker.on("failed", (_, err) => {
  console.log("JOB FAILED");

  console.error(err);
});

console.log("WORKER STARTED");
