import { createClient, type RedisClientType } from "redis";
import { getRedisConfig } from "../config/plugin-config.js";

export interface RedisConfig {
  host: string;
  port: number;
  password?: string;
  db?: number;
  keyPrefix?: string;
}

function buildDefaultConfig(): RedisConfig {
  const config = getRedisConfig();
  return {
    host: config.host || "localhost",
    port: config.port || 6380,
    password: config.password || undefined,
    db: config.db || 0,
    keyPrefix: config.keyPrefix || "meichao:",
  };
}

let client: RedisClientType | null = null;

export function createClient_(config: Partial<RedisConfig> = {}): RedisClientType {
  const defaultConfig = buildDefaultConfig();
  const finalConfig = { ...defaultConfig, ...config };
  client = createClient({
    socket: {
      host: finalConfig.host,
      port: finalConfig.port,
    },
    password: finalConfig.password,
    database: finalConfig.db,
  }) as RedisClientType;
  return client;
}

export function getClient(): RedisClientType {
  if (!client) {
    return createClient_();
  }
  return client;
}

export async function connectClient(): Promise<void> {
  const c = getClient();
  if (!c.isOpen) {
    await c.connect();
  }
}

export async function disconnectClient(): Promise<void> {
  if (client && client.isOpen) {
    await client.disconnect();
    client = null;
  }
}

export async function healthCheck(): Promise<boolean> {
  try {
    const c = getClient();
    if (!c.isOpen) {
      await c.connect();
    }
    await c.ping();
    return true;
  } catch {
    return false;
  }
}
