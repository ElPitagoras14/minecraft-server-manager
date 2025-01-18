import Redis from "ioredis";
import { databaseConfig } from "./config";

const { redis: redisConfig } = databaseConfig;

const redisClient = new Redis({
  host: redisConfig.host || "localhost",
  port: redisConfig.port ? parseInt(redisConfig.port) : 6379,
});

export default redisClient;
