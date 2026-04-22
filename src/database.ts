import { mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { DatabaseSync } from "node:sqlite";

export interface ParkedChannelRecord {
  guildId: string;
  channelId: string;
  updatedAt: number;
}

interface ParkedChannelRow {
  guild_id: string;
  channel_id: string;
  updated_at: number;
}

export class ParkingDatabase {
  private readonly database: DatabaseSync;

  constructor(databasePath: string) {
    const resolvedPath = resolve(process.cwd(), databasePath);
    mkdirSync(dirname(resolvedPath), { recursive: true });

    this.database = new DatabaseSync(resolvedPath);
    this.database.exec(`
      CREATE TABLE IF NOT EXISTS parked_channels (
        guild_id TEXT PRIMARY KEY,
        channel_id TEXT NOT NULL,
        updated_at INTEGER NOT NULL
      )
    `);
  }

  upsertParkedChannel(guildId: string, channelId: string): void {
    this.database
      .prepare(
        `
          INSERT INTO parked_channels (guild_id, channel_id, updated_at)
          VALUES (?, ?, ?)
          ON CONFLICT(guild_id) DO UPDATE SET
            channel_id = excluded.channel_id,
            updated_at = excluded.updated_at
        `,
      )
      .run(guildId, channelId, Date.now());
  }

  getParkedChannel(guildId: string): ParkedChannelRecord | undefined {
    const row = this.database
      .prepare("SELECT guild_id, channel_id, updated_at FROM parked_channels WHERE guild_id = ?")
      .get(guildId) as ParkedChannelRow | undefined;

    return row ? mapRow(row) : undefined;
  }

  listParkedChannels(): ParkedChannelRecord[] {
    const rows = this.database
      .prepare("SELECT guild_id, channel_id, updated_at FROM parked_channels ORDER BY guild_id ASC")
      .all() as unknown as ParkedChannelRow[];

    return rows.map(mapRow);
  }

  deleteParkedChannel(guildId: string): void {
    this.database.prepare("DELETE FROM parked_channels WHERE guild_id = ?").run(guildId);
  }
}

function mapRow(row: ParkedChannelRow): ParkedChannelRecord {
  return {
    guildId: row.guild_id,
    channelId: row.channel_id,
    updatedAt: row.updated_at,
  };
}
