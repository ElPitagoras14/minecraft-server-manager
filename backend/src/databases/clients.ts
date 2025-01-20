import mysql from "mysql2/promise";
import { databaseConfig } from "./config";
import { logger } from "../log";

const { serverManagerDb } = databaseConfig;

export const serverManagerPool = mysql.createPool({
  host: serverManagerDb.host,
  user: serverManagerDb.user,
  password: serverManagerDb.password,
  database: serverManagerDb.database,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
});

export const executeQuery = async (
  query: string,
  values: any[],
  pool: mysql.Pool
): Promise<{ result: any; fields: any }> => {
  const maxRetries = 5;
  const delay = 5000;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const [result, fields] = await pool.execute(query, values);
      return { result, fields };
    } catch (error: any) {
      logger.error(`Query failed: ${error.message}`, {
        filename: "clients.ts",
        func: "executeQuery",
        extra: {
          attempt,
          maxRetries,
        },
      });

      if (attempt < maxRetries) {
        logger.info(`Retrying query in ${delay / 1000} seconds`, {
          filename: "clients.ts",
          func: "executeQuery",
          extra: {
            attempt,
            maxRetries,
          },
        });
        await new Promise((resolve) => setTimeout(resolve, delay));
      }
    }
  }
  throw new Error(`Query failed after ${maxRetries} attempts`);
};
