import test from "node:test";
import assert from "node:assert/strict";

import { createApp } from "../app.js";
import { sourceQueue } from "../queues/source.queue.js";
import { redisConnection as queueRedisConnection } from "../queues/redis.connection.js";
import { redisConnection as databaseRedisConnection } from "../database/redis.js";
import { postgresPool } from "../database/postgres.js";
import { prisma } from "../db/index.js";

let server;
let baseUrl;

test.before(async () => {
  const app = createApp();
  server = await new Promise((resolve) => {
    const instance = app.listen(0, () => resolve(instance));
  });
  const address = server.address();
  baseUrl = `http://127.0.0.1:${address.port}`;
});

test.after(async () => {
  await new Promise((resolve) => server.close(resolve));
  await Promise.allSettled([
    sourceQueue.close(),
    queueRedisConnection.quit(),
    databaseRedisConnection.quit(),
    postgresPool.end(),
    prisma.$disconnect(),
  ]);
});

test("GET /health returns liveness", async () => {
  const response = await fetch(`${baseUrl}/health`);
  const body = await response.json();

  assert.equal(response.status, 200);
  assert.equal(body.status, "ok");
  assert.equal(body.service, "rag-backend");
});

test("GET /ready returns readiness envelope", async () => {
  const response = await fetch(`${baseUrl}/ready`);
  const body = await response.json();

  assert.ok([200, 503].includes(response.status));
  assert.ok(["ready", "not_ready"].includes(body.status));
  assert.ok(body.checks.database);
  assert.ok(body.checks.redis);
  assert.ok(body.checks.qdrant);
});

test("GET /api/config exposes only safe frontend config", async () => {
  const response = await fetch(`${baseUrl}/api/config`);
  const body = await response.json();
  const serialized = JSON.stringify(body);

  assert.equal(response.status, 200);
  assert.equal(body.success, true);
  assert.equal(body.data.streamingSupported, true);
  assert.equal(serialized.includes("OPENAI_API_KEY"), false);
  assert.equal(serialized.includes("DATABASE_URL"), false);
});

test("unknown route returns JSON 404", async () => {
  const response = await fetch(`${baseUrl}/api/does-not-exist`);
  const body = await response.json();

  assert.equal(response.status, 404);
  assert.equal(body.success, false);
  assert.equal(body.error.code, "ROUTE_NOT_FOUND");
});
