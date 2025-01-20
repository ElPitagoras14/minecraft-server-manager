import { CommandInteraction, SlashCommandBuilder } from "discord.js";

export const data = new SlashCommandBuilder()
  .setName("ping")
  .setDescription("Replies with info");

export async function execute(interaction: CommandInteraction) {
  const {
    user: { id, username },
  } = interaction;
  const roles = interaction.guild?.members.cache
    .get(id)
    ?.roles.cache.map((role) => role.name);
  await interaction.reply(`${id} - ${username} - ${roles}`);
  await interaction.editReply("Pong!");
}
