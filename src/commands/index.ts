import type {
  ChatInputCommandInteraction,
  SlashCommandBuilder,
  SlashCommandOptionsOnlyBuilder,
} from "discord.js";

import type { ParkingManager } from "../parking-manager.js";
import { parkCommand } from "./park.js";

export interface CommandContext {
  parkingManager: ParkingManager;
}

export interface SlashCommand {
  data: SlashCommandBuilder | SlashCommandOptionsOnlyBuilder;
  execute(interaction: ChatInputCommandInteraction, context: CommandContext): Promise<void>;
}

export const commands: SlashCommand[] = [parkCommand];

export const commandMap = new Map(commands.map((command) => [command.data.name, command]));
