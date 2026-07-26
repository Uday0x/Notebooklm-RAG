import { QdrantClient } from "@qdrant/js-client-rest";
import { config } from "../config/index.js";

export const qdrantClient = new QdrantClient({
  url: config.qdrantUrl,
  apiKey: config.qdrantApiKey,
});
