import { openai } from "./openai.client.js";
import { config } from "../config/index.js";

const DEFAULT_BATCH_SIZE = Number(
  process.env.EMBEDDING_BATCH_SIZE ?? 50
);

/**
 * Flow: Chunks → batch chunk texts → OpenAI embeddings → attach vector to each chunk.
 */
export async function embedChunks(
  chunks,
  {
    batchSize = DEFAULT_BATCH_SIZE,
  } = {}
) {
  if (!Array.isArray(chunks) || chunks.length === 0) {
    throw new Error(
      "embedChunks requires at least one chunk"
    );
  }

  if (
    !Number.isInteger(batchSize) ||
    batchSize <= 0
  ) {
    throw new Error(
      "batchSize must be a positive integer"
    );
  }

  const validChunks = chunks.filter(
    (chunk) =>
      typeof chunk?.text === "string" &&
      chunk.text.trim()
  );

  if (validChunks.length === 0) {
    throw new Error(
      "No valid chunk text was provided"
    );
  }

  if (!config.openaiApiKey) {
    throw new Error("OPENAI_API_KEY is required for embeddings");
  }

  const embeddedChunks = [];

  for (
    let startIndex = 0;
    startIndex < validChunks.length;
    startIndex += batchSize
  ) {
    const batch = validChunks.slice(
      startIndex,
      startIndex + batchSize
    );

    const response = await openai.embeddings.create({
      model: config.embeddingModel,

      input: batch.map((chunk) =>
        chunk.text.trim()
      ),

      encoding_format: "float",
    });

    const sortedEmbeddingData = [
      ...response.data,
    ].sort((first, second) => {
      return first.index - second.index;
    });

    if (
      sortedEmbeddingData.length !== batch.length
    ) {
      throw new Error(
        "Embedding count does not match chunk count"
      );
    }

    batch.forEach((chunk, batchIndex) => {
      const vector =
        sortedEmbeddingData[batchIndex]?.embedding;

      if (
        !Array.isArray(vector) ||
        vector.length === 0
      ) {
        throw new Error(
          `Embedding missing for chunk ${
            chunk.chunkIndex ?? batchIndex + 1
          }`
        );
      }

      embeddedChunks.push({
        ...chunk,
        vector,
        embeddingModel: config.embeddingModel,
      });
    });
  }

  return embeddedChunks;
}
