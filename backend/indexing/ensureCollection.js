import { qdrantClient } from "./qdrant.client.js";
import { config } from "../config/index.js";

const COLLECTION_NAME =
  config.qdrantCollection;

const VECTOR_SIZE = Number(
  config.qdrantVectorSize
);

/**
 * Flow: Check Qdrant collection → create it if missing → return collection name.
 */
export async function ensureCollection() {
  const response =
    await qdrantClient.getCollections();

  const collectionExists =
    response.collections.some(
      (collection) =>
        collection.name === COLLECTION_NAME
    );

  if (collectionExists) {
    return COLLECTION_NAME;
  }

  await qdrantClient.createCollection(
    COLLECTION_NAME,
    {
      vectors: {
        size: VECTOR_SIZE,
        distance: "Cosine",
      },
    }
  );

  console.log(
    `Qdrant collection created: ${COLLECTION_NAME}`
  );

  return COLLECTION_NAME;
}
