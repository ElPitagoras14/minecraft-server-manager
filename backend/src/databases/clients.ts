import mysql from "mysql2/promise";
import { databaseConfig } from "./config";
import { logger } from "../log";

const { serverManagerDb } = databaseConfig;

export const serverManagerPool = mysql.createPool({
  host: serverManagerDb.host,
  port: parseInt(serverManagerDb.port || "3306"),
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
  try {
    const [result, fields] = await pool.execute(query, values);
    return { result, fields };
  } catch (error) {
    logger.error("Error executing query", {
      filename: "clients.ts",
      func: "executeQuery",
      extra: error,
    });
    throw error;
  }
};
