import { randomUUID } from "node:crypto";

import { qdrantClient } from "./qdrant.client.js";
import { ensureCollection } from "./ensureCollection.js";
export {
  deleteSourceVectors,
} from "./deleteSourceVectors.js";

/**
 * Flow: Embedded chunks → convert to Qdrant points → upsert vectors and payload.
 */
export async function indexChunks({
  notebookId,
  sourceId,
  sourceTitle,
  sourceType,
  embeddedChunks,
}) {
  if (!notebookId) {
    throw new Error("notebookId is required");
  }

  if (!sourceId) {
    throw new Error("sourceId is required");
  }

  if (!sourceType) {
    throw new Error("sourceType is required");
  }

  if (
    !Array.isArray(embeddedChunks) ||
    embeddedChunks.length === 0
  ) {
    throw new Error(
      "indexChunks requires embedded chunks"
    );
  }

  const collectionName =
    await ensureCollection();

  const points = embeddedChunks.map(
    (chunk) => {
      if (
        !Array.isArray(chunk.vector) ||
        chunk.vector.length === 0
      ) {
        throw new Error(
          `Vector missing for chunk ${
            chunk.chunkIndex ?? "unknown"
          }`
        );
      }

      return {
        id: randomUUID(),

        vector: chunk.vector,

        payload: {
          notebookId,
          sourceId,
          sourceTitle:
            sourceTitle ?? "Untitled source",
          sourceType,

          chunkIndex: chunk.chunkIndex,
          text: chunk.text,
          location: chunk.location ?? {},
          segmentCount:
            chunk.segmentCount ?? null,

          embeddingModel:
            chunk.embeddingModel ?? null,
        },
      };
    }
  );

  await qdrantClient.upsert(
    collectionName,
    {
      wait: true,
      points,
    }
  );

  return {
    collectionName,
    sourceId,
    indexedCount: points.length,
    pointIds: points.map((point) => point.id),
  };
}