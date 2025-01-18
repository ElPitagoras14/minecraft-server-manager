import { Client } from "discord.js";
import { deployCommands } from "./deploy-commands";
import { commands } from "./commands";
import { generalConfig } from "./config";

const client = new Client({
  intents: ["Guilds", "GuildMessages", "DirectMessages"],
});

client.once("ready", async () => {
  await deployCommands();
  console.log("Discord bot is ready! 🤖");
});

client.on("interactionCreate", async (interaction) => {
  if (!interaction.isCommand()) {
    return;
  }
  console.log(interaction.commandName);
  const { commandName } = interaction;
  if (commands[commandName as keyof typeof commands]) {
    const command = commands[commandName as keyof typeof commands];
    try {
      await command.execute(interaction);
    } catch (error) {
      console.error(error);
      await interaction.reply({
        content: "There was an error while executing this command!",
        ephemeral: true,
      });
    }
  }
});

client.login(generalConfig.token);
