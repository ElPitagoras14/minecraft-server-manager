import { ButtonInteraction, CacheType, MessageFlags } from "discord.js";
import { authToken } from "..";
import axios, { isAxiosError } from "axios";
import { checkServerIsReady } from "../web-socket";
import { generalConfig } from "../config";
import { logger } from "../log";

const {
  backend: { host, port },
} = generalConfig;

export const handleButtonInput = async (
  interaction: ButtonInteraction<CacheType>
) => {
  const data = JSON.parse(interaction.customId);
  const { customId } = data;

  if (customId === "start-server") {
    try {
      const { serverId } = data;
      const userId = interaction.user.id;
      const roles = interaction.guild?.members.cache
        .get(userId)
        ?.roles.cache.map((role) => role.name);

      const startServerOptions = {
        url: `http://${host}:${port}/server/start/${serverId}`,
        method: "PUT",
        headers: {
          Authorization: `Bearer ${authToken}`,
        },
        data: {
          requesterId: userId,
          requesterRoles: roles,
        },
      };
      const response = await axios.request(startServerOptions);
      const {
        data: {
          payload: { jobId, worldName },
        },
      } = response;
      await interaction.deferReply();
      await interaction.editReply(
        `Server \`${worldName}\` is starting. Job ID: \`${jobId}\``
      );
      await checkServerIsReady(serverId, worldName, jobId, interaction);
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
  } else if (customId === "stop-server") {
    try {
      const { serverId } = data;
      const userId = interaction.user.id;
      const roles = interaction.guild?.members.cache
        .get(userId)
        ?.roles.cache.map((role) => role.name);

      const stopServerOptions = {
        url: `http://${host}:${port}/server/stop/${serverId}`,
        method: "PUT",
        headers: {
          Authorization: `Bearer ${authToken}`,
        },
        data: {
          requesterId: userId,
          requesterRoles: roles,
        },
      };
      const response = await axios.request(stopServerOptions);
      const {
        data: {
          payload: { worldName },
        },
      } = response;
      await interaction.deferReply();
      await interaction.editReply(`Server \`${worldName}\` is stopped.`);
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
