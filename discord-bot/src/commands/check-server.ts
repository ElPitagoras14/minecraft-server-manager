import {
  CommandInteraction,
  MessageFlags,
  SlashCommandBuilder,
} from "discord.js";
import axios from "axios";
import { logger } from "../log";
import { generalConfig } from "../config";
import { authToken } from "..";

const {
  backend: { host, port },
} = generalConfig;

export const data = new SlashCommandBuilder()
  .setName("checkserver")
  .setDescription("Check the status of the server")
  .addStringOption((option) =>
    option
      .setName("server-id")
      .setDescription("The server ID")
      .setRequired(true)
  );

export async function execute(interaction: CommandInteraction) {
  try {
    logger.info("Checking server status", {
      filename: "check-server.ts",
      func: "execute",
    });
    const serverId = interaction.options.get("server-id")?.value;
    const checkStatusOptions = {
      url: `http://${host}:${port}/server/info/${serverId}`,
      method: "GET",
      headers: {
        Authorization: `Bearer ${authToken}`,
      },
    };
    const response = await axios.request(checkStatusOptions);
    const {
      data: {
        payload: { status },
      },
    } = response;
    return interaction.reply(`Status: ${status ? "Running" : "Stopped"}`);
  } catch (error: any) {
    const { response: { data } = {} } = error;
    logger.error("Error fetching status:", {
      filename: "check-init.ts",
      func: "execute",
      extra: data,
    });

    if (data.statusCode !== 500) {
      return interaction.reply(data.message);
    }

    return interaction.reply({
      content: "There was an error while fetching the status.",
      flags: MessageFlags.Ephemeral,
    });
  }
}
