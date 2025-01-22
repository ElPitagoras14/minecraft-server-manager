import { Client, Events } from "discord.js";
import { deployCommands } from "./deploy-commands";
import { generalConfig } from "./config";
import { logger } from "./log";
import { handleCommandInput } from "./handle-types/handle-command";
import { handleModalInput } from "./handle-types/handle-modal";
import { initWebSocketConnection } from "./web-socket";
import { getAuthToken } from "./utils";
import { handleStringSelectInput } from "./handle-types/handle-select";
import { handleButtonInput } from "./handle-types/handle-button";

export let authToken: string;

(async () => {
  authToken = await getAuthToken();
})();

initWebSocketConnection();

const client = new Client({
  intents: ["Guilds", "GuildMessages", "DirectMessages"],
});

client.once(Events.ClientReady, async (readyClient) => {
  await deployCommands();
  logger.info(`Ready! Logged in as ${readyClient.user.tag}`, {
    filename: "index.ts",
    func: "client.once",
  });
});

client.on(Events.InteractionCreate, async (interaction) => {
  if (interaction.isChatInputCommand()) {
    return handleCommandInput(interaction);
  } else if (interaction.isModalSubmit()) {
    return handleModalInput(interaction);
  } else if (interaction.isStringSelectMenu()) {
    return handleStringSelectInput(interaction);
  } else if (interaction.isButton()) {
    return handleButtonInput(interaction);
  }
});

client.login(generalConfig.token);
