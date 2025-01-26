import {
  ActionRowBuilder,
  CommandInteraction,
  MessageFlags,
  ModalBuilder,
  SlashCommandBuilder,
  TextInputBuilder,
  TextInputStyle,
} from "discord.js";
import { logger } from "../log";
import { isAxiosError } from "axios";

export const data = new SlashCommandBuilder()
  .setName("createserver")
  .setDescription("Create a new server!");

export async function execute(interaction: CommandInteraction) {
  try {
    logger.info("Creating server", {
      filename: "create-server.ts",
      func: "execute",
    });

    const modal = new ModalBuilder()
      .setCustomId("create-server")
      .setTitle("Create Server Form");

    const worldNameInput = new TextInputBuilder()
      .setCustomId("world-name")
      .setLabel("World Name")
      .setPlaceholder("Enter the world name")
      .setStyle(TextInputStyle.Short)
      .setRequired(true);

    const versionInput = new TextInputBuilder()
      .setCustomId("version")
      .setLabel("Version")
      .setValue("LATEST")
      .setPlaceholder("Enter the version")
      .setStyle(TextInputStyle.Short);

    const descriptionInput = new TextInputBuilder()
      .setCustomId("description")
      .setLabel("Description")
      .setValue("A minecraft server")
      .setPlaceholder("Enter the description")
      .setStyle(TextInputStyle.Short);

    const firstActionRow =
      new ActionRowBuilder<TextInputBuilder>().addComponents(worldNameInput);
    const secondActionRow =
      new ActionRowBuilder<TextInputBuilder>().addComponents(versionInput);
    const thirdActionRow =
      new ActionRowBuilder<TextInputBuilder>().addComponents(descriptionInput);

    modal.addComponents(firstActionRow, secondActionRow, thirdActionRow);

    await interaction.showModal(modal);
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
