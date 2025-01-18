import { CommandInteraction, SlashCommandBuilder } from "discord.js";
import axios from "axios";

export const data = new SlashCommandBuilder()
  .setName("createserver")
  .setDescription("Create a new server!");

export async function execute(interaction: CommandInteraction) {
  try {
    const checkStatusOptions = {
      url: "http://localhost:3000/server",
      method: "POST",
    };
    const response = await axios.request(checkStatusOptions);
    const {
      data: {
        payload: { taskId, containerId },
      },
    } = response;
    return interaction.reply(
      `The server has been created. Check if it is ready using: ${taskId} and search info with: ${containerId.slice(
        0,
        12
      )}`
    );
  } catch (error: any) {
    const { response: { data } = {} } = error;
    console.error("Error fetching status:", data);

    if (data.statusCode === 404) {
      return interaction.reply("Job ID not found.");
    }

    return interaction.reply("There was an error while fetching the status.");
  }
}
