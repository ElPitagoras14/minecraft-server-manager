import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  CacheType,
  EmbedBuilder,
  MessageFlags,
  StringSelectMenuInteraction,
} from "discord.js";
import { generalConfig } from "../config";
import { authToken } from "..";
import axios, { isAxiosError } from "axios";
import { logger } from "../log";
import { getEmbedButtons, getServerInfoEmbed } from "../utils";

const {
  backend: { host, port },
} = generalConfig;

export const handleStringSelectInput = async (
  interaction: StringSelectMenuInteraction<CacheType>
) => {
  const customId = interaction.customId;
  if (customId === "server-info") {
    try {
      const serverId = interaction.values[0];
      const userId = interaction.user.id;
      const username = interaction.user.username;

      const serverInfoOptions = {
        url: `http://${host}:${port}/servers/${serverId}`,
        method: "GET",
        headers: {
          Authorization: `Bearer ${authToken}`,
        },
        params: {
          requesterId: userId,
          requesterUser: username,
        },
      };
      const response = await axios.request(serverInfoOptions);
      const {
        data: { payload },
      } = response;

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
};
