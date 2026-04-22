import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

import { parse } from "smol-toml";

export interface AppConfig {
  discord: {
    token: string;
    clientId: string;
  };
  database: {
    path: string;
  };
}

const CONFIG_PATH = resolve(process.cwd(), "config.toml");

export function loadConfig(): AppConfig {
  if (!existsSync(CONFIG_PATH)) {
    throw new Error(
      `Missing config file at ${CONFIG_PATH}. Copy config.example.toml to config.toml and fill in your Discord values.`,
    );
  }

  let parsedConfig: unknown;

  try {
    parsedConfig = parse(readFileSync(CONFIG_PATH, "utf8"));
  } catch (error) {
    throw new Error(`Failed to parse ${CONFIG_PATH}: ${formatError(error)}`);
  }

  if (!isRecord(parsedConfig)) {
    throw new Error(`Invalid config format in ${CONFIG_PATH}. Expected a TOML table at the root.`);
  }

  const discord = parsedConfig.discord;

  if (!isRecord(discord)) {
    throw new Error(`Missing [discord] table in ${CONFIG_PATH}.`);
  }

  return {
    discord: {
      token: requireString(discord.token, "discord.token"),
      clientId: requireString(discord.clientId, "discord.clientId"),
    },
    database: {
      path: optionalString(readTableValue(parsedConfig, "database", "path")) ?? "data/cursedcode.db",
    },
  };
}

function readTableValue(
  root: Record<string, unknown>,
  tableName: string,
  keyName: string,
): unknown {
  const table = root[tableName];
  if (!isRecord(table)) {
    return undefined;
  }

  return table[keyName];
}

function requireString(value: unknown, keyName: string): string {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new Error(`Missing required string value for "${keyName}" in ${CONFIG_PATH}.`);
  }

  return value.trim();
}

function optionalString(value: unknown): string | undefined {
  if (value === undefined) {
    return undefined;
  }

  if (typeof value !== "string" || value.trim().length === 0) {
    throw new Error(`Expected an optional string value in ${CONFIG_PATH}, but received an invalid entry.`);
  }

  return value.trim();
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function formatError(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }

  return String(error);
}
