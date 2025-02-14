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
  .setName("checktask")
  .setDescription("Check if the server is ready")
  .addIntegerOption((option) =>
    option.setName("job-id").setDescription("The job ID").setRequired(true)
  );

export async function execute(interaction: CommandInteraction) {
  try {
    logger.info("Checking server status", {
      filename: "check-init.ts",
      func: "execute",
    });
    const jobId = interaction.options.get("job-id")?.value;
    const checkStatusOptions = {
      url: `http://${host}:${port}/servers/job-status/${jobId}`,
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
    return interaction.reply(
      `Status: ${status === "in-progress" ? "In progress" : "Ready"}`
    );
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
