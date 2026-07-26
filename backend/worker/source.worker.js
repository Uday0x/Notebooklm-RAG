import "dotenv/config";
import { Worker } from "bullmq";

import {
  SOURCE_QUEUE_NAME,
  redisConnection,
} from "../queues/index.js";

import {
  parseSource,
} from "../parser/index.js";

import {
  chunkSegments,
} from "../chunking/index.js";

import {
  embedChunks,
} from "../embeddings/index.js";

import {
  indexChunks,
} from "../indexing/index.js";

import {
  prisma,
} from "../db/index.js";

export const sourceWorker = new Worker(
  SOURCE_QUEUE_NAME,

  async (job) => {
    const {
      sourceId,
      notebookId,
      sourceType,
      storagePath,
      title,
      content,
      url,
    } = job.data;

    console.log(
      `Processing source: ${sourceId}`
    );

    try {
      // 1. Source processing start
      await prisma.source.update({
        where: {
          id: sourceId,
        },

        data: {
          status: "PROCESSING",
          errorMessage: null,
        },
      });

      await job.updateProgress(10);

      // 2. Parse source
      const parsedSource =
        await parseSource({
          sourceType,

          // File parsers ke liye
          storagePath,
          filePath: storagePath,

          // Text source ke liye
          content,
          text: content,

          // Website/YouTube ke liye
          url,

          title,
        });

      if (
        !parsedSource?.segments ||
        parsedSource.segments.length === 0
      ) {
        throw new Error(
          "Parser returned no segments"
        );
      }

      console.log(
        `Parsed ${parsedSource.segments.length} segments`
      );

      await job.updateProgress(30);

      // 3. Chunk parsed segments
      const chunks = chunkSegments(
        parsedSource.segments
      );

      if (
        !Array.isArray(chunks) ||
        chunks.length === 0
      ) {
        throw new Error(
          "Chunker returned no chunks"
        );
      }

      console.log(
        `Created ${chunks.length} chunks`
      );

      await job.updateProgress(50);

      // 4. Generate embeddings
      const embeddedChunks =
        await embedChunks(chunks);

      if (
        !Array.isArray(embeddedChunks) ||
        embeddedChunks.length === 0
      ) {
        throw new Error(
          "Embedding module returned no embedded chunks"
        );
      }

      console.log(
        `Generated ${embeddedChunks.length} embeddings`
      );

      await job.updateProgress(75);

      // 5. Store vectors in Qdrant
      await indexChunks({
        notebookId,
        sourceId,

        sourceTitle:
          parsedSource.title ||
          title ||
          "Untitled source",

        sourceType,

        embeddedChunks,
      });

      await job.updateProgress(95);

      // 6. Mark source ready
      const updatedSource =
        await prisma.source.update({
          where: {
            id: sourceId,
          },

          data: {
            status: "READY",
            errorMessage: null,
          },
        });

      await job.updateProgress(100);

      console.log(
        `Source processing completed: ${sourceId}`
      );

      return {
        sourceId,
        notebookId,
        status: updatedSource.status,
        segmentCount:
          parsedSource.segments.length,
        chunkCount: chunks.length,
      };
    } catch (error) {
      console.error(
        `Source processing failed: ${sourceId}`,
        error
      );

      try {
        await prisma.source.update({
          where: {
            id: sourceId,
          },

          data: {
            status: "FAILED",
            errorMessage:
              error.message ||
              "Unknown processing error",
          },
        });
      } catch (databaseError) {
        console.error(
          "Failed to update source status:",
          databaseError
        );
      }

      // BullMQ ko batayega ki job fail hui.
      // Attempts configured hain toh retry bhi hogi.
      throw error;
    }
  },

  {
    connection: redisConnection,
    concurrency: 2,
  }
);

sourceWorker.on(
  "ready",
  () => {
    console.log(
      "Source worker is ready"
    );
  }
);

sourceWorker.on(
  "active",
  (job) => {
    console.log(
      `Source job started: ${job.id}`
    );
  }
);

sourceWorker.on(
  "progress",
  (job, progress) => {
    console.log(
      `Source job ${job.id}: ${progress}%`
    );
  }
);

sourceWorker.on(
  "completed",
  (job, result) => {
    console.log(
      `Source job completed: ${job.id}`,
      result
    );
  }
);

sourceWorker.on(
  "failed",
  (job, error) => {
    console.error(
      `Source job failed: ${job?.id}`,
      error.message
    );
  }
);

sourceWorker.on(
  "error",
  (error) => {
    console.error(
      "Source worker error:",
      error
    );
  }
);

let shuttingDown = false;

async function shutdown(signal) {
  if (shuttingDown) {
    return;
  }

  shuttingDown = true;
  console.log(`${signal} received. Closing worker...`);

  const forceExitTimer = setTimeout(() => {
    console.error("Forced worker shutdown after timeout");
    process.exit(1);
  }, 10000);

  await Promise.allSettled([
    sourceWorker.close(),
    redisConnection.quit(),
    prisma.$disconnect(),
  ]);

  clearTimeout(forceExitTimer);
  process.exit(0);
}

process.on("SIGINT", () => shutdown("SIGINT"));
process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("unhandledRejection", (error) => {
  console.error("Unhandled worker rejection:", error);
});
process.on("uncaughtException", (error) => {
  console.error("Uncaught worker exception:", error);
  shutdown("uncaughtException");
});
