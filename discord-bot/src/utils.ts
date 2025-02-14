import { generalConfig } from "./config";
import axios from "axios";
import { logger } from "./log";
import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
} from "discord.js";

const { backend, admin } = generalConfig;

interface ServerInfo {
  version: string;
  status: string;
  name: string;
  port: number;
  creatorId: string;
  roleName: string;
}

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

const tryGetAuthToken = async (
  attempts: number = 0
): Promise<string | null> => {
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
    if (attempts < 5) {
      logger.warn(
        `Error getting Auth Token, attempt ${attempts + 1}/5. Retrying...`,
        {
          filename: "check-init.ts",
          func: "execute",
          extra: error,
        }
      );
      await new Promise((resolve) => setTimeout(resolve, 5000)); // Esperar 5 segundos
      return tryGetAuthToken(attempts + 1);
    } else {
      logger.error("Error getting Auth Token after 5 attempts:", {
        filename: "check-init.ts",
        func: "execute",
        extra: error,
      });
      return null;
    }
  }
};

export const getAuthToken = async () => {
  const token = await tryGetAuthToken();
  if (token) {
    return token;
  } else {
    logger.error("Failed to retrieve auth token after multiple attempts", {
      filename: "check-init.ts",
      func: "getAuthToken",
    });
    throw new Error("Failed to retrieve auth token");
  }
};

export const getServerInfoEmbed = (
  serverId: string,
  serverInfo: ServerInfo
) => {
  const {
    version,
    status,
    name,
    port: serverPort,
    creatorId,
    roleName,
  } = serverInfo;

  const serverEmbed = new EmbedBuilder()
    .setColor(0x0099ff)
    .setTitle(`Server ${name}`)
    .addFields(
      {
        name: "ID",
        value: serverId,
      },
      {
        name: "Version",
        value: version,
        inline: true,
      },
      {
        name: "Port",
        value: `${serverPort}`,
        inline: true,
      },
      {
        name: "Status",
        value: status,
        inline: true,
      }
    )
    .addFields(
      {
        name: "Creator",
        value: `<@${creatorId}>`,
        inline: true,
      },
      {
        name: "Role",
        value: roleName ?? "No role",
        inline: true,
      }
    )
    .setTimestamp();

  return serverEmbed;
};

export const getEmbedButtons = (serverId: string, status: string) => {
  const startData = JSON.stringify({
    customId: "start-server",
    serverId,
  });

  const stopData = JSON.stringify({
    customId: "stop-server",
    serverId,
  });

  const restartData = JSON.stringify({
    customId: "restart-server",
    serverId,
  });

  const startButton = new ButtonBuilder()
    .setCustomId(startData)
    .setLabel("Start Server")
    .setStyle(ButtonStyle.Primary);

  const stopButton = new ButtonBuilder()
    .setCustomId(stopData)
    .setLabel("Stop Server")
    .setStyle(ButtonStyle.Danger);

  const restartButton = new ButtonBuilder()
    .setCustomId(restartData)
    .setLabel("Restart Server")
    .setStyle(ButtonStyle.Secondary);

  if (status === "RUNNING" || status === "STARTING") {
    startButton.setDisabled(true);
  }

  if (status === "STOPPED" || status === "STARTING") {
    stopButton.setDisabled(true);
  }

  const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
    stopButton,
    startButton,
    restartButton
  );

  return row;
};
