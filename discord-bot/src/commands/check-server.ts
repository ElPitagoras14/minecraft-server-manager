import { CommandInteraction, SlashCommandBuilder } from "discord.js";
import axios from "axios";

export const data = new SlashCommandBuilder()
  .setName("checkserver")
  .setDescription("Check the status of the server")
  .addStringOption((option) =>
    option
      .setName("server-id")
      .setDescription("The server ID")
      .setRequired(true)
  );

export async function execute(interaction: CommandInteraction) {
  try {
    const serverId = interaction.options.get("server-id")?.value;
    const checkStatusOptions = {
      url: `http://localhost:3000/server/status/${serverId}`,
      method: "GET",
    };
    const response = await axios.request(checkStatusOptions);
    const {
      data: {
        payload: { Running },
      },
    } = response;
    return interaction.reply(`Status: ${Running ? "Running" : "Stopped"}`);
  } catch (error) {
    console.error("Error fetching status:", error);
    return interaction.reply("There was an error while fetching the status.");
  }
}
