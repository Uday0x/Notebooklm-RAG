import IORedis from "ioredis";
import { config } from "../config/index.js";

export const redisConnection = config.redisUrl
  ? new IORedis(config.redisUrl, {
      maxRetriesPerRequest: null,
    })
  : new IORedis({
      host: config.redisHost,
      port: config.redisPort,
      maxRetriesPerRequest: null,
    });

redisConnection.on(
  "connect",
  () => {
    console.log(
      "Redis connection established"
    );
  }
);

redisConnection.on(
  "error",
  (error) => {
    console.error(
      "Redis connection error:",
      error.message
    );
  }
);
