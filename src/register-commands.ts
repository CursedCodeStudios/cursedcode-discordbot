import { REST, Routes } from "discord.js";

import { commands } from "./commands/index.js";
import { loadConfig } from "./config.js";

async function registerCommands(): Promise<void> {
  const config = loadConfig();

  const rest = new REST({ version: "10" }).setToken(config.discord.token);
  const commandPayload = commands.map((command) => command.data.toJSON());

  await rest.put(Routes.applicationCommands(config.discord.clientId), { body: commandPayload });

  console.log(`Registered ${commandPayload.length} global command(s) for CursedCode.`);
  console.log("Global command updates can take a little time to appear in Discord.");
}

registerCommands().catch((error) => {
  console.error("Failed to register slash commands:", error);
  process.exitCode = 1;
});
