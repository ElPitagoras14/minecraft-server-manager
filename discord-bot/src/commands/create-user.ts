import {
  CommandInteraction,
  MessageFlags,
  SlashCommandBuilder,
} from "discord.js";
import axios, { isAxiosError } from "axios";
import { logger } from "../log";
import { generalConfig } from "../config";
import { authToken } from "..";

const {
  backend: { host, port },
} = generalConfig;

export const data = new SlashCommandBuilder()
  .setName("createuser")
  .setDescription("Create a user to create servers")
  .addStringOption((option) =>
    option
      .setName("password")
      .setDescription("The server password")
      .setRequired(true)
  );

export async function execute(interaction: CommandInteraction) {
  try {
    logger.info("Creating user", {
      filename: "create-user.ts",
      func: "execute",
    });
    const password = interaction.options.get("password")?.value;
    const userId = interaction.user.id;
    const username = interaction.user.username;

    const createUserOptions = {
      url: `http://${host}:${port}/users`,
      method: "POST",
      headers: {
        Authorization: `Bearer ${authToken}`,
      },
      data: {
        id: userId,
        username,
        password,
      },
    };

    const response = await axios.request(createUserOptions);
    const {
      data: {
        payload: { username: newUsername },
      },
    } = response;

    console.log(response.data);

    return interaction.reply({
      content: `User ${newUsername} created successfully. Please contact an admin to get access.`,
      flags: MessageFlags.Ephemeral,
    });
  } catch (error: any) {
    if (isAxiosError(error)) {
      const { response: { data } = {} } = error;
      logger.error("Error creating user:", {
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
      content: "There was an error while creating the user.",
      flags: MessageFlags.Ephemeral,
    });
  }
}
