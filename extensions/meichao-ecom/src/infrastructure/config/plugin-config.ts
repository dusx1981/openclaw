import type { RedisConfig } from "../cache/redis.js";
import type { PostgresConfig } from "../storage/postgres.js";

export interface OpenSearchConfig {
  bingApiKey?: string;
  bingCustomConfigId?: string;
}

let postgresConfig: Partial<PostgresConfig> = {};
let redisConfig: Partial<RedisConfig> = {};
let openSearchConfig: Partial<OpenSearchConfig> = {};

export function setPostgresConfig(config: Partial<PostgresConfig> | undefined): void {
  if (config) {
    postgresConfig = { ...config };
  } else {
    postgresConfig = {};
  }
}

export function setRedisConfig(config: Partial<RedisConfig> | undefined): void {
  if (config) {
    redisConfig = { ...config };
  } else {
    redisConfig = {};
  }
}

export function setOpenSearchConfig(config: Partial<OpenSearchConfig> | undefined): void {
  if (config) {
    openSearchConfig = { ...config };
  } else {
    openSearchConfig = {};
  }
}

export function getPostgresConfig(): Partial<PostgresConfig> {
  return {
    host: postgresConfig.host || process.env.POSTGRES_HOST || "localhost",
    port: parseInt(String(postgresConfig.port ?? process.env.POSTGRES_PORT ?? "5434"), 10),
    database: postgresConfig.database || process.env.POSTGRES_DB || "meichao_ecom",
    user: postgresConfig.user || process.env.POSTGRES_USER || "meichao",
    password: postgresConfig.password || process.env.POSTGRES_PASSWORD || "meichao_secret",
    maxConnections: parseInt(
      String(postgresConfig.maxConnections ?? process.env.POSTGRES_MAX_CONNECTIONS ?? "10"),
      10,
    ),
    idleTimeoutMs: parseInt(
      String(postgresConfig.idleTimeoutMs ?? process.env.POSTGRES_IDLE_TIMEOUT ?? "30000"),
      10,
    ),
    connectionTimeoutMs: parseInt(
      String(
        postgresConfig.connectionTimeoutMs ?? process.env.POSTGRES_CONNECTION_TIMEOUT ?? "5000",
      ),
      10,
    ),
  };
}

export function getRedisConfig(): Partial<RedisConfig> {
  return {
    host: redisConfig.host || process.env.REDIS_HOST || "localhost",
    port: parseInt(String(redisConfig.port ?? process.env.REDIS_PORT ?? "6380"), 10),
    password: redisConfig.password ?? process.env.REDIS_PASSWORD ?? undefined,
    db: parseInt(String(redisConfig.db ?? process.env.REDIS_DB ?? "0"), 10),
    keyPrefix: redisConfig.keyPrefix || process.env.REDIS_KEY_PREFIX || "meichao:",
  };
}

export function resetConfig(): void {
  postgresConfig = {};
  redisConfig = {};
  openSearchConfig = {};
}

export function getOpenSearchConfig(): OpenSearchConfig {
  return {
    bingApiKey:
      openSearchConfig.bingApiKey || process.env.BING_API_KEY || process.env.BING_SEARCH_API_KEY,
    bingCustomConfigId: openSearchConfig.bingCustomConfigId || process.env.BING_CUSTOM_CONFIG_ID,
  };
}
