import IORedis from "ioredis";
import { config } from "../config/index.js";

export const redisConnection = config.redisUrl
  ? new IORedis(config.redisUrl, {
      maxRetriesPerRequest: null,
    })
  : new IORedis({
      host: config.redisHost,
      port: config.redisPort,

      // BullMQ worker ke liye required/recommended.
      maxRetriesPerRequest: null,
    });

redisConnection.on("connect", () => {
  console.log("Redis connected");
});

redisConnection.on("ready", () => {
  console.log("Redis ready");
});

redisConnection.on("error", (error) => {
  console.error("Redis error:", error.message);
});

export async function connectRedis() {
  const response = await redisConnection.ping();

  if (response !== "PONG") {
    throw new Error("Redis ping failed");
  }

  return true;
}

export async function checkRedisConnection() {
  const response = await redisConnection.ping();
  return response === "PONG";
}
