import path from "node:path";
import { fileURLToPath } from "node:url";

import dotenv from "dotenv";

const configDir = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(configDir, "../.env") });

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
export const OPENAI_TRANSCRIPTION_FILE_LIMIT_BYTES =
  25 * 1024 * 1024;
export const DEFAULT_WEBSITE_TIMEOUT_MS = 15_000;
export const DEFAULT_WEBSITE_MAX_RESPONSE_BYTES =
  2 * 1024 * 1024;
export const DEFAULT_WEBSITE_MIN_READABLE_TEXT_LENGTH = 200;
export const DEFAULT_WEBSITE_REDIRECT_LIMIT = 5;

export function parseStrictBooleanFlag(value) {
  return String(value ?? "").trim().toLowerCase() === "true";
}

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
  audioTranscriptionModel:
    process.env.AUDIO_TRANSCRIPTION_MODEL ??
    "whisper-1",
  youtubeAudioFallbackEnabled:
    process.env.YOUTUBE_AUDIO_FALLBACK_ENABLED !== "false",
  youtubeMaxDurationSeconds: Number(
    process.env.YOUTUBE_MAX_DURATION_SECONDS ?? 3600
  ),
  youtubeMaxAudioBytes: Number(
    process.env.YOUTUBE_MAX_AUDIO_BYTES ??
      OPENAI_TRANSCRIPTION_FILE_LIMIT_BYTES
  ),
  websiteBrowserFallbackEnabled:
    parseStrictBooleanFlag(process.env.WEBSITE_BROWSER_FALLBACK_ENABLED),
  websiteTimeoutMs: Number(
    process.env.WEBSITE_TIMEOUT_MS ?? DEFAULT_WEBSITE_TIMEOUT_MS
  ),
  websiteMaxResponseBytes: Number(
    process.env.WEBSITE_MAX_RESPONSE_BYTES ??
      DEFAULT_WEBSITE_MAX_RESPONSE_BYTES
  ),
  websiteMinReadableTextLength: Number(
    process.env.WEBSITE_MIN_READABLE_TEXT_LENGTH ??
      process.env.WEBSITE_MIN_TEXT_LENGTH ??
      DEFAULT_WEBSITE_MIN_READABLE_TEXT_LENGTH
  ),
  websiteRedirectLimit: Number(
    process.env.WEBSITE_REDIRECT_LIMIT ??
      DEFAULT_WEBSITE_REDIRECT_LIMIT
  ),
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
  exposeErrorDetails:
    process.env.EXPOSE_ERROR_DETAILS === "true" ||
    process.env.NODE_ENV === "development",
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
