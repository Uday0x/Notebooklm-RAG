import { openai } from "./openai.client.js";
import { config } from "../config/index.js";

/**
 * Flow: Single text → OpenAI embedding API → numeric vector.
 */
export async function embedText(text) {
  if (typeof text !== "string" || !text.trim()) {
    throw new Error(
      "embedText requires non-empty text"
    );
  }

  if (!config.openaiApiKey) {
    throw new Error("OPENAI_API_KEY is required for embeddings");
  }

  const response = await openai.embeddings.create({
    model: config.embeddingModel,
    input: text.trim(),
    encoding_format: "float",
  });

  const vector = response.data[0]?.embedding;

  if (!Array.isArray(vector) || vector.length === 0) {
    throw new Error(
      "Embedding API returned an empty vector"
    );
  }

  return vector;
}
