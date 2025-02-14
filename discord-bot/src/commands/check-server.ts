import {
  CommandInteraction,
  MessageFlags,
  SlashCommandBuilder,
} from "discord.js";
import axios, { isAxiosError } from "axios";
import { logger } from "../log";
import { generalConfig } from "../config";
import { authToken } from "..";
import { getEmbedButtons, getServerInfoEmbed } from "../utils";

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
    const serverInfoOptions = {
      url: `http://${host}:${port}/servers/${serverId}`,
      method: "GET",
      headers: {
        Authorization: `Bearer ${authToken}`,
      },
    };
    const response = await axios.request(serverInfoOptions);
    const {
      data: { payload },
    } = response;

    if (Object.keys(payload).length === 0) {
      return interaction.reply({
        content: "Server not found.",
        flags: MessageFlags.Ephemeral,
      });
    }

    const { status } = payload;
    const serverInfoEmbed = getServerInfoEmbed(serverId as string, payload);
    const rowButtons = getEmbedButtons(serverId as string, status);

    await interaction.reply({
      embeds: [serverInfoEmbed],
      components: [rowButtons],
      flags: MessageFlags.Ephemeral,
    });
  } catch (error: any) {
    if (isAxiosError(error)) {
      const { response: { data } = {} } = error;
      logger.error("Error fetching status:", {
        filename: "check-init.ts",
        func: "execute",
        extra: data,
      });

      if (data.statusCode !== 500) {
        return interaction.reply({
          content: data.message,
          flags: MessageFlags.Ephemeral,
        });
      }
    }
    await interaction.reply({
      content: "There was an error while fetching the status.",
      flags: MessageFlags.Ephemeral,
    });
  }
}
