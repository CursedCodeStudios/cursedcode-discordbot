import {
  ChannelType,
  ChatInputCommandInteraction,
  PermissionFlagsBits,
  SlashCommandBuilder,
} from "discord.js";

import type { CommandContext } from "./index.js";

export const parkCommand = {
  data: new SlashCommandBuilder()
    .setName("park")
    .setDescription("Join a voice channel and stay there.")
    .setDefaultMemberPermissions(PermissionFlagsBits.Connect)
    .addChannelOption((option) =>
      option
        .setName("channel")
        .setDescription("The voice channel to join.")
        .addChannelTypes(ChannelType.GuildVoice, ChannelType.GuildStageVoice)
        .setRequired(true),
    ),
  async execute(
    interaction: ChatInputCommandInteraction,
    context: CommandContext,
  ): Promise<void> {
    if (!interaction.inGuild() || !interaction.guildId) {
      await interaction.reply({
        content: "This command can only be used inside a server.",
        ephemeral: true,
      });
      return;
    }

    const selectedChannel = interaction.options.getChannel("channel", true, [
      ChannelType.GuildVoice,
      ChannelType.GuildStageVoice,
    ]);

    if (selectedChannel.guild.id !== interaction.guildId) {
      await interaction.reply({
        content: "That channel must be in this server.",
        ephemeral: true,
      });
      return;
    }

    try {
      await context.parkingManager.park(selectedChannel);

      await interaction.reply({
        content: `Parked in ${selectedChannel.toString()} while muted and deafened.`,
        ephemeral: true,
      });
    } catch (error) {
      await interaction.reply({
        content: `I couldn't join ${selectedChannel.toString()}. Check my voice permissions and try again.`,
        ephemeral: true,
      });

      console.error("Failed to park in voice channel:", error);
    }
  },
};
