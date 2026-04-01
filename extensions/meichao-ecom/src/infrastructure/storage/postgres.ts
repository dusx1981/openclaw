import pg from "pg";
const { Pool } = pg;

import { getPostgresConfig } from "../config/plugin-config.js";

export interface PostgresConfig {
  host: string;
  port: number;
  database: string;
  user: string;
  password: string;
  maxConnections?: number;
  idleTimeoutMs?: number;
  connectionTimeoutMs?: number;
}

function buildDefaultConfig(): PostgresConfig {
  const config = getPostgresConfig();
  return {
    host: config.host || "localhost",
    port: config.port || 5434,
    database: config.database || "meichao_ecom",
    user: config.user || "meichao",
    password: config.password || "meichao_secret",
    maxConnections: config.maxConnections || 10,
    idleTimeoutMs: config.idleTimeoutMs || 30000,
    connectionTimeoutMs: config.connectionTimeoutMs || 5000,
  };
}

let pool: pg.Pool | null = null;

export function createPool(config: Partial<PostgresConfig> = {}): pg.Pool {
  const defaultConfig = buildDefaultConfig();
  const finalConfig = { ...defaultConfig, ...config };
  pool = new Pool({
    host: finalConfig.host,
    port: finalConfig.port,
    database: finalConfig.database,
    user: finalConfig.user,
    password: finalConfig.password,
    max: finalConfig.maxConnections,
    idleTimeoutMillis: finalConfig.idleTimeoutMs,
    connectionTimeoutMillis: finalConfig.connectionTimeoutMs,
  });
  return pool;
}

export function getPool(): pg.Pool {
  if (!pool) {
    return createPool();
  }
  return pool;
}

export async function closePool(): Promise<void> {
  if (pool) {
    await pool.end();
    pool = null;
  }
}

export async function query<T extends pg.QueryResultRow = pg.QueryResultRow>(
  sql: string,
  params?: unknown[],
): Promise<T[]> {
  const client = getPool();
  const result = await client.query<T>(sql, params);
  return result.rows;
}

export async function queryOne<T extends pg.QueryResultRow = pg.QueryResultRow>(
  sql: string,
  params?: unknown[],
): Promise<T | null> {
  const rows = await query<T>(sql, params);
  return rows.length > 0 ? rows[0] : null;
}

export async function transaction<T>(fn: (client: pg.PoolClient) => Promise<T>): Promise<T> {
  const client = await getPool().connect();
  try {
    await client.query("BEGIN");
    const result = await fn(client);
    await client.query("COMMIT");
    return result;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

export async function healthCheck(): Promise<boolean> {
  try {
    await query("SELECT 1");
    return true;
  } catch {
    return false;
  }
}
