import { QdrantClient } from "@qdrant/js-client-rest";
import { config } from "../config/index.js";

export const qdrantClient = new QdrantClient({
  url: config.qdrantUrl,
  apiKey: config.qdrantApiKey,
});

export async function connectQdrant() {
  const response = await qdrantClient.getCollections();

  console.log(
    `Qdrant connected. Collections: ${response.collections.length}`
  );

  return response;
}

export async function checkQdrantConnection() {
  await qdrantClient.getCollections();
  return true;
}
