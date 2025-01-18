import mysql from "mysql2/promise";
import { databaseConfig } from "./config";
const { mysql: serverManagerConfig } = databaseConfig;

export const serverManagerPool = mysql.createPool({
  host: serverManagerConfig.host,
  user: serverManagerConfig.user,
  password: serverManagerConfig.password,
  database: serverManagerConfig.database,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
});

export const executeQuery = async (
  query: string,
  values: any[],
  pool: mysql.Pool
) => {
  try {
    const [rows] = await pool.execute(query, values);
    return rows;
  } catch (error) {
    console.error("Error ejecutando query:", error);
    throw error;
  }
};
