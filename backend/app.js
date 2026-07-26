import "dotenv/config";
import express from "express";
import { fileURLToPath } from "node:url";

import { notebookRouter } from "./api/notebooks/index.js";
import { sourceRouter } from "./api/sources/index.js";
import { messageRouter } from "./api/messages/index.js";
import { conversationRouter } from "./api/conversations/index.js";
import {
  errorHandler,
  notFoundHandler,
} from "./api/middleware/errors.js";
import {
  config,
  DEFAULT_RETRIEVAL_LIMIT,
  MAX_RETRIEVAL_LIMIT,
  SOURCE_TYPES,
  SUPPORTED_FILE_EXTENSIONS,
  validateRequiredConfig,
} from "./config/index.js";

import {
  connectPostgres,
  checkPostgresConnection,
  postgresPool,
} from "./database/postgres.js";

import {
  connectRedis,
  checkRedisConnection,
  redisConnection,
} from "./database/redis.js";

import {
  connectQdrant,
  checkQdrantConnection,
} from "./database/qdrant.js";

import { prisma } from "./db/index.js";
import { sourceQueue } from "./queues/source.queue.js";
import {
  checkYoutubeFallbackTools,
} from "./parser/youtube/externalTools.js";

export function createApp() {
  const app = express();

  app.disable("x-powered-by");
  app.use(corsMiddleware);
  app.use(express.json({ limit: "1mb" }));

  app.get("/health", (request, response) => {
    response.status(200).json({
      status: "ok",
      service: config.serviceName,
      timestamp: new Date().toISOString(),
      uptime: Math.round(process.uptime()),
    });
  });

  app.get("/ready", async (request, response) => {
    const checks = {
      database: "ok",
      redis: "ok",
      qdrant: "ok",
    };

    await Promise.all([
      checkReadiness("database", checks, checkPostgresConnection),
      checkReadiness("redis", checks, checkRedisConnection),
      checkReadiness("qdrant", checks, checkQdrantConnection),
    ]);

    const ready = Object.values(checks).every((status) => status === "ok");

    response.status(ready ? 200 : 503).json({
      status: ready ? "ready" : "not_ready",
      checks,
      timestamp: new Date().toISOString(),
    });
  });

  app.get("/api/config", (request, response) => {
    response.status(200).json({
      success: true,
      data: {
        apiVersion: config.apiVersion,
        streamingSupported: true,
        maxUploadBytes: config.maxUploadBytes,
        supportedSourceTypes: SOURCE_TYPES,
        supportedFileExtensions: SUPPORTED_FILE_EXTENSIONS,
        defaultRetrievalLimit: DEFAULT_RETRIEVAL_LIMIT,
        maxRetrievalLimit: MAX_RETRIEVAL_LIMIT,
        youtubeAudioFallbackEnabled:
          config.youtubeAudioFallbackEnabled,
        youtubeMaxDurationSeconds:
          config.youtubeMaxDurationSeconds,
        youtubeMaxAudioBytes:
          config.youtubeMaxAudioBytes,
      },
    });
  });

  app.use("/api/notebooks", notebookRouter);
  app.use("/api", sourceRouter);
  app.use("/api", conversationRouter);
  app.use("/api", messageRouter);

  app.get("/", (request, response) => {
    response.json({
      message: "NotebookLM backend is running",
    });
  });

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}

async function checkReadiness(name, checks, checker) {
  try {
    checks[name] = (await withTimeout(checker(), 1500)) ? "ok" : "error";
  } catch (error) {
    checks[name] = "error";
  }
}

function withTimeout(promise, timeoutMs) {
  return Promise.race([
    promise,
    new Promise((resolve) => {
      setTimeout(() => resolve(false), timeoutMs);
    }),
  ]);
}

function corsMiddleware(request, response, next) {
  const requestOrigin = request.get("origin");

  if (requestOrigin) {
    if (
      config.corsOrigins.length === 0 ||
      config.corsOrigins.includes(requestOrigin)
    ) {
      response.setHeader("Access-Control-Allow-Origin", requestOrigin);
      response.setHeader("Vary", "Origin");
    }
  }

  response.setHeader(
    "Access-Control-Allow-Headers",
    "Content-Type, Accept"
  );
  response.setHeader(
    "Access-Control-Allow-Methods",
    "GET,POST,PATCH,DELETE,OPTIONS"
  );

  if (request.method === "OPTIONS") {
    return response.sendStatus(204);
  }

  return next();
}

export async function startServer() {
  validateRequiredConfig();

  if (config.youtubeAudioFallbackEnabled) {
    await checkYoutubeFallbackTools();
  }

  await connectPostgres();
  await connectRedis();
  await connectQdrant();

  const app = createApp();
  const server = app.listen(config.port, () => {
    console.log(`API running at http://localhost:${config.port}`);
  });

  registerShutdown(server);
  return server;
}

function registerShutdown(server) {
  let shuttingDown = false;

  async function shutdown(signal) {
    if (shuttingDown) {
      return;
    }

    shuttingDown = true;
    console.log(`${signal} received. Closing API...`);

    const forceExitTimer = setTimeout(() => {
      console.error("Forced shutdown after timeout");
      process.exit(1);
    }, 10000);

    server.close(async () => {
      await Promise.allSettled([
        sourceQueue.close(),
        redisConnection.quit(),
        postgresPool.end(),
        prisma.$disconnect(),
      ]);

      clearTimeout(forceExitTimer);
      process.exit(0);
    });
  }

  process.on("SIGINT", () => shutdown("SIGINT"));
  process.on("SIGTERM", () => shutdown("SIGTERM"));
}

const currentFilePath = fileURLToPath(import.meta.url);

if (process.argv[1] === currentFilePath) {
  startServer().catch((error) => {
    console.error("Backend startup failed:", error.message);
    process.exit(1);
  });
}
