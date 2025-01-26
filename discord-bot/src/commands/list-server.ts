import {
  ActionRowBuilder,
  CommandInteraction,
  MessageFlags,
  SlashCommandBuilder,
  StringSelectMenuBuilder,
  StringSelectMenuOptionBuilder,
} from "discord.js";
import axios, { isAxiosError } from "axios";
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

    const userId = interaction.user.id;
    const username = interaction.user.username;
    const roles = interaction.guild?.members.cache
      .get(userId)
      ?.roles.cache.map((role) => role.name);

    const allServerOptions = {
      url: `http://${host}:${port}/server`,
      method: "GET",
      headers: {
        Authorization: `Bearer ${authToken}`,
      },
      params: {
        requesterId: userId,
        requesterRoles: roles,
        requesterUser: username,
      },
    };
    console.log(allServerOptions);
    const response = await axios.request(allServerOptions);
    const {
      data: {
        payload: { items = [], total = 0 },
      },
    } = response;

    if (total === 0) {
      return interaction.reply({
        content: "No servers found",
        flags: MessageFlags.Ephemeral,
      });
    }

    const selectOptions = items.map((item: any) =>
      new StringSelectMenuOptionBuilder().setLabel(item.name).setValue(item.id)
    );
    const select = new StringSelectMenuBuilder()
      .setCustomId("server-info")
      .setPlaceholder("Select a server to inspect")
      .addOptions(selectOptions);
    const row = new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(
      select
    );

    const headers = ["ID", "World Name", "Version", "Port", "Status"];
    const rows = items.map((item: any) => [
      item.id,
      item.name,
      item.version,
      `${item.port}`,
      item.status,
    ]);
    const table = createTable(headers, rows);

    await interaction.reply({
      content: `\`\`\`${table}\`\`\`\nSelect a server to inspect`,
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
