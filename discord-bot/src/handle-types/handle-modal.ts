import { CacheType, MessageFlags, ModalSubmitInteraction } from "discord.js";
import axios, { isAxiosError } from "axios";
import { generalConfig } from "../config";
import { logger } from "../log";
import { checkServerIsReady } from "../web-socket";
import { authToken } from "..";

const {
  backend: { host, port },
} = generalConfig;

export const handleModalInput = async (
  interaction: ModalSubmitInteraction<CacheType>
) => {
  const customId = interaction.customId;

  if (customId === "create-server") {
    try {
      const userId = interaction.user.id;
      const username = interaction.user.username;

      const worldName = interaction.fields.getTextInputValue("world-name");
      const version = interaction.fields.getTextInputValue("version");
      const description = interaction.fields.getTextInputValue("description");

      const createServerOptions = {
        url: `http://${host}:${port}/server`,
        method: "POST",
        headers: {
          Authorization: `Bearer ${authToken}`,
        },
        data: {
          worldName,
          version,
          description,
          requesterId: userId,
          requesterUser: username,
        },
      };
      const response = await axios.request(createServerOptions);
      const {
        data: {
          payload: { jobId, serverId },
        },
      } = response;

      await interaction.deferReply();
      await interaction.editReply({
        content: `Server \`${worldName}\` with id \`${serverId}\` is being created. Job ID: \`${jobId}\``,
      });

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
          return interaction.reply(data.message);
        }
      }
      return interaction.reply({
        content: "There was an error while fetching the status.",
        flags: MessageFlags.Ephemeral,
      });
    }
  }
};
