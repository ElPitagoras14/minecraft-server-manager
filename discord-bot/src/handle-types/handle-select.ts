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

      const getServerInfoOptions = {
        url: `http://${host}:${port}/server/${serverId}`,
        method: "GET",
        headers: {
          Authorization: `Bearer ${authToken}`,
        },
      };

      const response = await axios.request(getServerInfoOptions);
      const {
        data: {
          payload: {
            status,
            name,
            version,
            port: worldPort,
            creatorId,
            roleName,
          },
        },
      } = response;

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
            value: `${worldPort}`,
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

      const startData = JSON.stringify({
        customId: "start-server",
        serverId,
      });
      const stopData = JSON.stringify({
        customId: "stop-server",
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

      if (status === "READY" || status === "INITIALIZING") {
        startButton.setDisabled(true);
      }

      if (status === "DOWN" || status === "INITIALIZING") {
        stopButton.setDisabled(true);
      }

      const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
        stopButton,
        startButton
      );

      await interaction.reply({
        embeds: [serverEmbed],
        components: [row],
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
