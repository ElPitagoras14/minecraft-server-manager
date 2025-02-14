import Redis from "ioredis";
import { databaseConfig } from "../databases/config";

const { queueDb } = databaseConfig;

const redisClient = new Redis({
  host: queueDb.host || "localhost",
  port: queueDb.port ? parseInt(queueDb.port) : 6379,
});

export default redisClient;
