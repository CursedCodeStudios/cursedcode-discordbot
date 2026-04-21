import { REST, Routes } from "discord.js";

import { commands } from "./commands/index.js";
import { loadConfig } from "./config.js";

async function registerCommands(): Promise<void> {
  const config = loadConfig();

  const rest = new REST({ version: "10" }).setToken(config.discord.token);
  const commandPayload = commands.map((command) => command.data.toJSON());

  await rest.put(
    Routes.applicationGuildCommands(config.discord.clientId, config.discord.guildId),
    { body: commandPayload },
  );

  console.log(`Registered ${commandPayload.length} guild command(s) for CursedCode.`);
}

registerCommands().catch((error) => {
  console.error("Failed to register slash commands:", error);
  process.exitCode = 1;
});
