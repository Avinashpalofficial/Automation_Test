import { Queue } from "bullmq";

import { redisConnection } from "../config/redis";

export const jobQueue = new Queue("execution-queue", {
  connection: redisConnection,
});
