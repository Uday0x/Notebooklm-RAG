import "dotenv/config";

import { prisma } from "../db/index.js";
import { deleteSourceVectors } from "../indexing/deleteSourceVectors.js";
import { addSourceProcessingJob, sourceQueue } from "../queues/source.queue.js";
import { redisConnection } from "../queues/redis.connection.js";

const sourceId = process.argv[2];

if (!sourceId) {
  console.error("Usage: node scripts/reprocess-source.js <sourceId>");
  process.exit(1);
}

try {
  const source = await prisma.source.findUnique({
    where: {
      id: sourceId,
    },
  });

  if (!source) {
    throw new Error(`Source not found: ${sourceId}`);
  }

  await deleteSourceVectors({
    notebookId: source.notebookId,
    sourceId: source.id,
  });

  await prisma.source.update({
    where: {
      id: source.id,
    },
    data: {
      status: "PENDING",
      errorMessage: null,
    },
  });

  await addSourceProcessingJob({
    sourceId: source.id,
    notebookId: source.notebookId,
    sourceType: source.type,
    storagePath: source.storagePath,
    title: source.title,
  });

  console.log(`Reprocessing queued for source ${source.id}`);
} finally {
  await Promise.allSettled([
    sourceQueue.close(),
    redisConnection.quit(),
    prisma.$disconnect(),
  ]);
}
