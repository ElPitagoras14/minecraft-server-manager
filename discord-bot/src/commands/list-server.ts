import {
  CommandInteraction,
  MessageFlags,
  SlashCommandBuilder,
} from "discord.js";
import axios from "axios";
import { logger } from "../log";
import { generalConfig } from "../config";
import { createTable } from "../utils";
import { authToken } from "..";

const {
  backend: { host, port },
} = generalConfig;

export const data = new SlashCommandBuilder()
  .setName("listserver")
  .setDescription("List all servers");

export async function execute(interaction: CommandInteraction) {
  try {
    logger.info("Checking server status", {
      filename: "check-init.ts",
      func: "execute",
    });
    const checkStatusOptions = {
      url: `http://${host}:${port}/server`,
      method: "GET",
      headers: {
        Authorization: `Bearer ${authToken}`,
      },
    };
    const response = await axios.request(checkStatusOptions);
    const {
      data: { payload: items },
    } = response;

    if (!items.length) {
      return interaction.reply({
        content: "No servers found",
        flags: MessageFlags.Ephemeral,
      });
    }

    const headers = ["ID", "World Name", "Version", "Port", "Status"];
    const rows = items.map((item: any) => [
      item.id,
      item.name,
      item.version,
      `${item.port}`,
      item.status,
    ]);
    const table = createTable(headers, rows);

    return interaction.reply({
      content: `\`\`\`${table}\`\`\``,
      flags: MessageFlags.Ephemeral,
    });
  } catch (error: any) {
    logger.error("Error fetching status:", {
      filename: "check-init.ts",
      func: "execute",
      extra: error,
    });
  }
}
