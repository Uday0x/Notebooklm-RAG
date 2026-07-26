import { embedText } from "../embeddings/index.js";
import { qdrantClient } from "../indexing/qdrant.client.js";
import { config } from "../config/index.js";

const COLLECTION_NAME =
  config.qdrantCollection;

/**
 * Flow: User query → embedding → Qdrant similarity search → relevant chunks.
 */
export async function searchChunks({
  query,
  notebookId,
  sourceIds = [],
  limit = 5,
  scoreThreshold,
}) {
  if (typeof query !== "string" || !query.trim()) {
    throw new Error("searchChunks requires a non-empty query");
  }

  if (!notebookId) {
    throw new Error("notebookId is required");
  }

  if (!Number.isInteger(limit) || limit <= 0) {
    throw new Error("limit must be a positive integer");
  }

  if (!Array.isArray(sourceIds)) {
    throw new Error("sourceIds must be an array");
  }

  const queryVector = await embedText(query.trim());

  const mustFilters = [
    {
      key: "notebookId",
      match: {
        value: notebookId,
      },
    },
  ];

  if (sourceIds.length > 0) {
    mustFilters.push({
      key: "sourceId",
      match: {
        any: sourceIds,
      },
    });
  }

  const searchRequest = {
    vector: queryVector,
    limit,
    with_payload: true,
    with_vector: false,

    filter: {
      must: mustFilters,
    },
  };

  if (typeof scoreThreshold === "number") {
    searchRequest.score_threshold = scoreThreshold;
  }

  const results = await qdrantClient.search(
    COLLECTION_NAME,
    searchRequest
  );

  return results.map((result, index) => ({
    rank: index + 1,
    pointId: result.id,
    score: result.score,

    text: result.payload?.text ?? "",

    metadata: {
      notebookId: result.payload?.notebookId,
      sourceId: result.payload?.sourceId,
      sourceTitle: result.payload?.sourceTitle,
      sourceType: result.payload?.sourceType,
      chunkIndex: result.payload?.chunkIndex,
      location: result.payload?.location ?? {},
      embeddingModel: result.payload?.embeddingModel,
    },
  }));
}
