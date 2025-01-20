import dotenv from "dotenv";
import path from "path";

const envPath = path.resolve(__dirname, "../../../.env");
dotenv.config({ path: envPath });

export const databaseConfig = {
  serverManagerDb: {
    host: process.env.MYSQL_HOST,
    user: process.env.MYSQL_USER,
    password: process.env.MYSQL_ROOT_PASSWORD,
    database: process.env.MYSQL_DATABASE,
  },
  queueDb: {
    host: process.env.REDIS_HOST,
    port: process.env.REDIS_PORT,
  }
};
