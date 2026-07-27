import { qdrantClient } from "./qdrant.client.js";
import { config } from "../config/index.js";

const COLLECTION_NAME =
  config.qdrantCollection;

const VECTOR_SIZE = Number(
  config.qdrantVectorSize
);

const REQUIRED_PAYLOAD_INDEXES = [
  "notebookId",
  "sourceId",
];

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

  if (!collectionExists) {
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
  }

  await ensurePayloadIndexes();

  return COLLECTION_NAME;
}

async function ensurePayloadIndexes() {
  const collectionInfo =
    await qdrantClient.getCollection(
      COLLECTION_NAME
    );

  const payloadSchema =
    collectionInfo.payload_schema ?? {};

  for (const fieldName of REQUIRED_PAYLOAD_INDEXES) {
    if (payloadSchema[fieldName]) {
      continue;
    }

    try {
      await qdrantClient.createPayloadIndex(
        COLLECTION_NAME,
        {
          field_name: fieldName,
          field_schema: "keyword",
          wait: true,
        }
      );

      console.log(
        `Qdrant payload index created: ${fieldName}`
      );
    } catch (error) {
      if (
        error?.status === 409 ||
        error?.statusCode === 409
      ) {
        continue;
      }

      throw error;
    }
  }
}
