import { CommandInteraction, SlashCommandBuilder } from "discord.js";
import axios from "axios";

export const data = new SlashCommandBuilder()
  .setName("checkinit")
  .setDescription("Check if the server is ready")
  .addIntegerOption((option) =>
    option.setName("job-id").setDescription("The job ID").setRequired(true)
  );

export async function execute(interaction: CommandInteraction) {
  try {
    const jobId = interaction.options.get("job-id")?.value;
    const checkStatusOptions = {
      url: `http://localhost:3000/server/check-init/${jobId}`,
      method: "GET",
    };
    console.log(checkStatusOptions);
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
    const { response: { data } = {} } = error;
    console.error("Error fetching status:", data);

    if (data.statusCode === 404) {
      return interaction.reply("Job ID not found.");
    }

    return interaction.reply("There was an error while fetching the status.");
  }
}
