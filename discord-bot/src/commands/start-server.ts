import {
  CommandInteraction,
  MessageFlags,
  SlashCommandBuilder,
} from "discord.js";
import axios, { isAxiosError } from "axios";
import { logger } from "../log";
import { generalConfig } from "../config";
import { checkServerIsReady } from "../web-socket";
import { authToken } from "..";

const {
  backend: { host, port },
} = generalConfig;

export const data = new SlashCommandBuilder()
  .setName("startserver")
  .setDescription("Initialize the server")
  .addStringOption((option) =>
    option
      .setName("server-id")
      .setDescription("The server ID")
      .setRequired(true)
  );

export async function execute(interaction: CommandInteraction) {
  try {
    const serverId = interaction.options.get("server-id")?.value as string;
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
      `Server with id \`${serverId}\` is starting. Job ID: \`${jobId}\``
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
        return interaction.reply(data.message);
      }
    }

    logger.error("Error fetching status:", {
      filename: "check-init.ts",
      func: "execute",
      extra: error,
    });

    return interaction.reply({
      content: "There was an error while fetching the status.",
      flags: MessageFlags.Ephemeral,
    });
  }
}
