import { generalConfig } from "./config";
import axios from "axios";
import { logger } from "./log";

const { backend, admin } = generalConfig;

export const createTable = (headers: string[], rows: string[][]): string => {
  const columnWidths = headers.map((header, i) =>
    Math.max(header.length, ...rows.map((row) => row[i]?.length || 0))
  );

  const formatRow = (row: string[]) =>
    row.map((cell, i) => cell.padEnd(columnWidths[i])).join(" | ");

  const headerRow = formatRow(headers);
  const separator = columnWidths.map((width) => "-".repeat(width)).join("-|-");
  const dataRows = rows.map(formatRow).join("\n");

  return `${headerRow}\n${separator}\n${dataRows}`;
};

export const getAuthToken = async () => {
  try {
    const loginOptions = {
      url: `http://${backend.host}:${backend.port}/auth/login`,
      method: "POST",
      data: {
        username: admin.username,
        password: admin.password,
      },
    };

    const response = await axios.request(loginOptions);
    const {
      data: {
        payload: { token },
      },
    } = response;

    logger.info("Got Auth Token", {
      filename: "check-init.ts",
      func: "execute",
    });

    return token;
  } catch (error) {
    logger.error("Error getting Auth Token:", {
      filename: "check-init.ts",
      func: "execute",
      extra: error,
    });
  }
};
