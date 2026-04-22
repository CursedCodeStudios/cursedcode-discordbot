import {
  entersState,
  getVoiceConnection,
  joinVoiceChannel,
  VoiceConnection,
  VoiceConnectionStatus,
} from "@discordjs/voice";
import {
  ChannelType,
  Client,
  Guild,
  PermissionFlagsBits,
  StageChannel,
  VoiceChannel,
} from "discord.js";

import { ParkingDatabase } from "./database.js";

type ParkableChannel = StageChannel | VoiceChannel;

interface TrackedConnection {
  connection: VoiceConnection;
  disconnectTimer?: NodeJS.Timeout;
}

class ParkingError extends Error {
  constructor(
    message: string,
    public readonly permanent: boolean,
  ) {
    super(message);
    this.name = "ParkingError";
  }
}

export class ParkingManager {
  private readonly retryTimers = new Map<string, NodeJS.Timeout>();
  private readonly retryCounts = new Map<string, number>();
  private readonly trackedConnections = new Map<string, TrackedConnection>();

  constructor(
    private readonly client: Client,
    private readonly database: ParkingDatabase,
  ) {}

  async park(channel: ParkableChannel): Promise<void> {
    await this.connectToChannel(channel.guild.id, channel.id, true, "slash command");
  }

  async restoreAll(): Promise<void> {
    const records = this.database.listParkedChannels();
    if (records.length === 0) {
      return;
    }

    console.log(`Restoring ${records.length} parked voice connection(s) from SQLite.`);

    await Promise.allSettled(records.map((record) => this.restoreGuild(record.guildId, "startup")));
  }

  private async restoreGuild(guildId: string, reason: string): Promise<void> {
    const record = this.database.getParkedChannel(guildId);
    if (!record) {
      return;
    }

    try {
      await this.connectToChannel(guildId, record.channelId, false, reason);
      console.log(`Restored parked voice connection for guild ${guildId}.`);
    } catch (error) {
      this.handleReconnectFailure(guildId, error, reason);
    }
  }

  private async connectToChannel(
    guildId: string,
    channelId: string,
    persist: boolean,
    reason: string,
  ): Promise<void> {
    this.cancelReconnect(guildId);

    const channel = await this.resolveParkableChannel(guildId, channelId);

    this.destroyExistingConnection(guildId, true);

    const connection = joinVoiceChannel({
      channelId: channel.id,
      guildId: channel.guild.id,
      adapterCreator: channel.guild.voiceAdapterCreator,
      selfMute: true,
      selfDeaf: true,
    });

    this.trackConnection(guildId, connection);

    try {
      await entersState(connection, VoiceConnectionStatus.Ready, 15_000);
    } catch (error) {
      this.destroyExistingConnection(guildId, true);
      throw new ParkingError(
        `Failed to connect to ${channel.toString()} while parking (${formatError(error)}).`,
        false,
      );
    }

    this.retryCounts.delete(guildId);

    if (persist) {
      this.database.upsertParkedChannel(guildId, channel.id);
      console.log(`Parked guild ${guildId} in channel ${channel.id} via ${reason}.`);
      return;
    }

    console.log(`Reconnected guild ${guildId} to channel ${channel.id} after ${reason}.`);
  }

  private async resolveParkableChannel(guildId: string, channelId: string): Promise<ParkableChannel> {
    const guild = await this.fetchGuild(guildId);
    const channel = await guild.channels.fetch(channelId);

    if (!channel) {
      throw new ParkingError(`Stored channel ${channelId} no longer exists.`, true);
    }

    if (channel.type !== ChannelType.GuildVoice && channel.type !== ChannelType.GuildStageVoice) {
      throw new ParkingError(`Stored channel ${channelId} is no longer a voice or stage channel.`, true);
    }

    const me = await guild.members.fetchMe();
    const permissions = channel.permissionsFor(me);
    const canJoin =
      channel.joinable &&
      permissions?.has(PermissionFlagsBits.ViewChannel) &&
      permissions.has(PermissionFlagsBits.Connect);

    if (!canJoin) {
      throw new ParkingError(`Missing permission to join ${channel.toString()}.`, true);
    }

    return channel;
  }

  private async fetchGuild(guildId: string): Promise<Guild> {
    try {
      const guild = await this.client.guilds.fetch(guildId);

      if (!guild.available) {
        throw new ParkingError(`Guild ${guildId} is unavailable.`, true);
      }

      return guild;
    } catch (error) {
      if (error instanceof ParkingError) {
        throw error;
      }

      throw new ParkingError(`Guild ${guildId} is no longer available to the bot.`, true);
    }
  }

  private trackConnection(guildId: string, connection: VoiceConnection): void {
    const tracked: TrackedConnection = { connection };
    this.trackedConnections.set(guildId, tracked);

    connection.on("stateChange", (_oldState, newState) => {
      const current = this.trackedConnections.get(guildId);
      if (!current || current.connection !== connection) {
        return;
      }

      if (newState.status === VoiceConnectionStatus.Ready) {
        if (current.disconnectTimer) {
          clearTimeout(current.disconnectTimer);
          current.disconnectTimer = undefined;
        }
        this.retryCounts.delete(guildId);
        return;
      }

      if (newState.status === VoiceConnectionStatus.Disconnected) {
        this.armReconnectForDisconnect(guildId, current);
        return;
      }

      if (newState.status === VoiceConnectionStatus.Destroyed) {
        if (current.disconnectTimer) {
          clearTimeout(current.disconnectTimer);
        }
        this.trackedConnections.delete(guildId);
        this.scheduleReconnect(guildId, "connection destroyed");
      }
    });

    connection.on("error", (error) => {
      console.error(`Voice connection error for guild ${guildId}:`, error);
    });
  }

  private armReconnectForDisconnect(guildId: string, tracked: TrackedConnection): void {
    if (tracked.disconnectTimer) {
      return;
    }

    tracked.disconnectTimer = setTimeout(() => {
      tracked.disconnectTimer = undefined;

      const current = this.trackedConnections.get(guildId);
      if (!current || current.connection !== tracked.connection) {
        return;
      }

      this.destroyExistingConnection(guildId, true);
      this.scheduleReconnect(guildId, "voice disconnect");
    }, 5_000);
  }

  private scheduleReconnect(guildId: string, reason: string): void {
    if (this.retryTimers.has(guildId)) {
      return;
    }

    if (!this.database.getParkedChannel(guildId)) {
      return;
    }

    const attempt = this.retryCounts.get(guildId) ?? 0;
    const delayMs = Math.min(30_000, 1_000 * 2 ** attempt);

    console.warn(`Scheduling reconnect for guild ${guildId} in ${delayMs}ms (${reason}).`);

    const timer = setTimeout(async () => {
      this.retryTimers.delete(guildId);
      this.retryCounts.set(guildId, attempt + 1);
      await this.restoreGuild(guildId, reason);
    }, delayMs);

    this.retryTimers.set(guildId, timer);
  }

  private cancelReconnect(guildId: string): void {
    const timer = this.retryTimers.get(guildId);
    if (timer) {
      clearTimeout(timer);
      this.retryTimers.delete(guildId);
    }
  }

  private destroyExistingConnection(guildId: string, intentional: boolean): void {
    const tracked = this.trackedConnections.get(guildId);
    if (tracked?.disconnectTimer) {
      clearTimeout(tracked.disconnectTimer);
    }

    this.trackedConnections.delete(guildId);

    const connection = tracked?.connection ?? getVoiceConnection(guildId);
    if (!connection) {
      return;
    }

    if (!intentional) {
      this.scheduleReconnect(guildId, "connection closed");
    }

    connection?.destroy();
  }

  private handleReconnectFailure(guildId: string, error: unknown, reason: string): void {
    if (error instanceof ParkingError && error.permanent) {
      console.warn(`Abandoning parked channel for guild ${guildId}: ${error.message}`);
      this.database.deleteParkedChannel(guildId);
      this.retryCounts.delete(guildId);
      this.cancelReconnect(guildId);
      return;
    }

    console.error(`Reconnect attempt failed for guild ${guildId} after ${reason}:`, error);
    this.scheduleReconnect(guildId, reason);
  }
}

function formatError(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }

  return String(error);
}
