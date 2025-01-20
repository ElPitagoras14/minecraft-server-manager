import {
  ChatInputCommandInteraction,
  CacheType,
  Collection,
  MessageFlags,
} from "discord.js";
import { commands } from "../commands";
import { logger } from "../log";

const cooldowns = new Collection<string, Collection<string, number>>();

export const handleCommandInput = async (
  interaction: ChatInputCommandInteraction<CacheType>
) => {
  const { commandName } = interaction;
  const command = commands[commandName as keyof typeof commands];

  if (!command) {
    logger.error(`Command ${commandName} not found`, {
      filename: "index.ts",
      func: "client.on",
    });
    return;
  }

  if (!cooldowns.has(commandName)) {
    cooldowns.set(commandName, new Collection<string, number>());
  }

  const now = Date.now();
  const timestamps = cooldowns.get(commandName);
  let cooldown = 3;
  if ("cooldown" in command) {
    cooldown = command.cooldown as number;
  }

  const cooldownAmount = cooldown * 1000;

  if (timestamps?.has(interaction.user.id)) {
    const expirationTime =
      (timestamps?.get(interaction.user.id) ?? 0) + cooldownAmount;

    if (now < expirationTime) {
      const timeLeft = (expirationTime - now) / 1000;
      return interaction.reply({
        content: `Please wait ${timeLeft.toFixed(
          1
        )} more second(s) before reusing the \`${commandName}\` command.`,
        flags: MessageFlags.Ephemeral,
      });
    }
  }

  timestamps?.set(interaction.user.id, now);
  setTimeout(() => timestamps?.delete(interaction.user.id), cooldownAmount);

  try {
    await command.execute(interaction);
  } catch (error: any) {
    logger.error(JSON.stringify(error), {
      filename: "index.ts",
      func: "client.on",
    });

    if (interaction.replied || interaction.deferred) {
      await interaction.followUp({
        content: "There was an error while executing this command!",
        flags: MessageFlags.Ephemeral,
      });
    } else {
      await interaction.reply({
        content: "There was an error while executing this command!",
        flags: MessageFlags.Ephemeral,
      });
    }
  }
};
