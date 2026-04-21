import { Client, Events, GatewayIntentBits } from "discord.js";

import { commandMap } from "./commands/index.js";
import { loadConfig } from "./config.js";

const config = loadConfig();

const client = new Client({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildVoiceStates],
});

client.once(Events.ClientReady, (readyClient) => {
  console.log(`CursedCode is online as ${readyClient.user.tag}.`);
});

client.on(Events.InteractionCreate, async (interaction) => {
  if (!interaction.isChatInputCommand()) {
    return;
  }

  const command = commandMap.get(interaction.commandName);
  if (!command) {
    return;
  }

  try {
    await command.execute(interaction);
  } catch (error) {
    console.error(`Error while handling /${interaction.commandName}:`, error);

    const reply = {
      content: "Something went wrong while running that command.",
      ephemeral: true,
    };

    if (interaction.replied || interaction.deferred) {
      await interaction.followUp(reply);
      return;
    }

    await interaction.reply(reply);
  }
});

client.login(config.discord.token).catch((error) => {
  console.error("Failed to log in to Discord:", error);
  process.exitCode = 1;
});
