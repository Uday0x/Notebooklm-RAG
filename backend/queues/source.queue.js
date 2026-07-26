import { Queue } from "bullmq";
import { redisConnection } from "./redis.connection.js";

export const SOURCE_QUEUE_NAME = "source-processing";

export const sourceQueue = new Queue(
  SOURCE_QUEUE_NAME,
  {
    connection: redisConnection,
  }
);

export async function addSourceProcessingJob(data) {
  return sourceQueue.add(
    "process-source",
    data,
    {
      jobId: data.sourceId,
      attempts: 3,
      backoff: {
        type: "exponential",
        delay: 2000,
      },
      removeOnComplete: {
        age: 24 * 60 * 60,
        count: 1000,
      },
      removeOnFail: {
        age: 7 * 24 * 60 * 60,
        count: 1000,
      },
    }
  );
}

export async function getSourceProcessingJobStatus(sourceId) {
  if (!sourceId) {
    return null;
  }

  const job = await sourceQueue.getJob(sourceId);

  if (!job) {
    return null;
  }

  return {
    jobId: job.id,
    name: job.name,
    state: await job.getState(),
    progress: job.progress,
    attemptsMade: job.attemptsMade,
    failedReason: job.failedReason ?? null,
  };
}
