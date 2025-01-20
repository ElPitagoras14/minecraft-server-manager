import { REST, Routes } from "discord.js";
import { generalConfig } from "./config";
import { commands } from "./commands";
import { logger } from "./log";

const commandsData = Object.values(commands).map((command) => command.data);

const rest = new REST().setToken(generalConfig.token);

export async function deployCommands() {
  try {
    logger.debug("Started refreshing application (/) commands.", {
      filename: "deploy-commands.ts",
      func: "deployCommands",
    });

    await rest.put(Routes.applicationCommands(generalConfig.clientId), {
      body: commandsData,
    });

    logger.debug("Successfully reloaded application (/) commands.", {
      filename: "deploy-commands.ts",
      func: "deployCommands",
    });
  } catch (error) {
    logger.error("Error refreshing application (/) commands.", {
      filename: "deploy-commands.ts",
      func: "deployCommands",
      extra: error,
    });
  }
}
