import "dotenv/config";

export const SOURCE_TYPES = [
  "PDF",
  "DOCX",
  "WEBSITE",
  "YOUTUBE",
  "TEXT",
  "VTT",
];

export const FILE_SOURCE_TYPES = [
  "PDF",
  "DOCX",
  "TEXT",
  "VTT",
];

export const SOURCE_STATUSES = [
  "PENDING",
  "PROCESSING",
  "READY",
  "FAILED",
];

export const SUPPORTED_FILE_EXTENSIONS = [
  ".pdf",
  ".docx",
  ".txt",
  ".vtt",
];

export const SUPPORTED_MIME_TYPES = [
  "application/pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "text/plain",
  "text/vtt",
  "text/vtt; charset=utf-8",
];

export const DEFAULT_RETRIEVAL_LIMIT = 5;
export const MAX_RETRIEVAL_LIMIT = 20;
export const DEFAULT_MESSAGE_PAGE_LIMIT = 20;
export const MAX_MESSAGE_PAGE_LIMIT = 100;
export const MAX_CONVERSATION_TITLE_LENGTH = 120;

export const config = {
  nodeEnv: process.env.NODE_ENV ?? "development",
  port: Number(process.env.PORT ?? 8000),
  apiVersion: process.env.API_VERSION ?? "1.0.0",
  serviceName: process.env.SERVICE_NAME ?? "rag-backend",
  databaseUrl: process.env.DATABASE_URL,
  redisUrl: process.env.REDIS_URL,
  redisHost: process.env.REDIS_HOST ?? "127.0.0.1",
  redisPort: Number(process.env.REDIS_PORT ?? 6379),
  qdrantUrl: process.env.QDRANT_URL ?? "http://localhost:6333",
  qdrantApiKey: process.env.QDRANT_API_KEY,
  qdrantCollection:
    process.env.QDRANT_COLLECTION ??
    process.env.QDRANT_COLLECTION_NAME ??
    "rag_chunks",
  qdrantVectorSize: Number(process.env.QDRANT_VECTOR_SIZE ?? 1536),
  openaiApiKey: process.env.OPENAI_API_KEY,
  embeddingModel:
    process.env.EMBEDDING_MODEL ?? "text-embedding-3-small",
  generationModel:
    process.env.GENERATION_MODEL ?? "gpt-4.1-mini",
  queryRewriteModel:
    process.env.QUERY_REWRITE_MODEL ?? "gpt-4.1-mini",
  conversationTitleModel:
    process.env.CONVERSATION_TITLE_MODEL ?? "gpt-4.1-mini",
  uploadDirectory:
    process.env.UPLOAD_DIR ??
    process.env.UPLOAD_DIRECTORY ??
    "storage/uploads",
  maxUploadBytes: Number(
    process.env.MAX_UPLOAD_BYTES ??
      Number(process.env.MAX_UPLOAD_SIZE_MB ?? 10) * 1024 * 1024
  ),
  corsOrigins: parseCorsOrigins(process.env.CORS_ORIGINS),
  logLevel: process.env.LOG_LEVEL ?? "info",
};

export function validateRequiredConfig() {
  const missing = [];

  if (!config.databaseUrl) {
    missing.push("DATABASE_URL");
  }

  if (!config.openaiApiKey) {
    missing.push("OPENAI_API_KEY");
  }

  if (missing.length > 0) {
    throw new Error(
      `Missing required environment variables: ${missing.join(", ")}`
    );
  }
}

function parseCorsOrigins(value) {
  if (!value || value.trim() === "*") {
    return [];
  }

  return value
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean);
}
