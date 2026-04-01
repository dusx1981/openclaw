import type { Pool, PoolClient } from "pg";
import type { StartedTestContainer } from "testcontainers";
import type { ProductData, Platform } from "../../src/domain/types.js";

export const SKIP_INTEGRATION = process.env.SKIP_INTEGRATION === "1";
export const ONLY_INTEGRATION = process.env.ONLY_INTEGRATION === "1";

export function shouldRunIntegrationTest(): boolean {
  if (SKIP_INTEGRATION) return false;
  return true;
}

export function isIntegrationOnly(): boolean {
  return ONLY_INTEGRATION;
}

export interface TestDatabaseConfig {
  host: string;
  port: number;
  database: string;
  user: string;
  password: string;
}

export const defaultTestDbConfig: TestDatabaseConfig = {
  host: "localhost",
  port: 5433,
  database: "meichao_test",
  user: "test",
  password: "test",
};

let testPool: Pool | null = null;

export async function getTestPool(): Promise<Pool> {
  if (testPool) return testPool;

  const { Pool } = await import("pg");
  testPool = new Pool({
    host: defaultTestDbConfig.host,
    port: defaultTestDbConfig.port,
    database: defaultTestDbConfig.database,
    user: defaultTestDbConfig.user,
    password: defaultTestDbConfig.password,
  });

  return testPool;
}

export async function cleanupTestData(pool: Pool): Promise<void> {
  await pool.query("DELETE FROM products WHERE platform = 'test'");
}

export async function seedTestProducts(pool: Pool, products: ProductData[]): Promise<void> {
  for (const product of products) {
    await pool.query(
      `INSERT INTO products (platform, platform_id, title, price, currency, sales, status)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       ON CONFLICT (platform, platform_id) DO UPDATE SET
         title = EXCLUDED.title,
         price = EXCLUDED.price,
         sales = EXCLUDED.sales,
         status = EXCLUDED.status`,
      [
        product.platform,
        product.platformId,
        product.title,
        product.price,
        product.currency,
        product.sales,
        product.status,
      ],
    );
  }
}

export async function closeTestPool(): Promise<void> {
  if (testPool) {
    await testPool.end();
    testPool = null;
  }
}

export class TransactionRollback {
  private pool: Pool;
  private client: PoolClient | null = null;

  constructor(pool: Pool) {
    this.pool = pool;
  }

  async begin(): Promise<void> {
    this.client = await this.pool.connect();
    await this.client.query("BEGIN");
  }

  async rollback(): Promise<void> {
    if (this.client) {
      await this.client.query("ROLLBACK");
      this.client.release();
      this.client = null;
    }
  }
}

export interface ContainerInfo {
  host: string;
  port: number;
  container: StartedTestContainer;
}

let postgresContainer: StartedTestContainer | null = null;
let redisContainer: StartedTestContainer | null = null;
let containerPool: Pool | null = null;

export async function startPostgres(): Promise<ContainerInfo> {
  const { GenericContainer } = await import("testcontainers");

  const container = await new GenericContainer("postgres:16-alpine")
    .withEnvironment({ POSTGRES_DB: "meichao_test" })
    .withEnvironment({ POSTGRES_USER: "test" })
    .withEnvironment({ POSTGRES_PASSWORD: "test" })
    .withExposedPorts(5432)
    .start();

  postgresContainer = container;

  const host = container.getHost();
  const port = container.getMappedPort(5432);

  const { Pool } = await import("pg");
  containerPool = new Pool({
    host,
    port,
    database: "meichao_test",
    user: "test",
    password: "test",
  });

  await containerPool.query(`
    CREATE TABLE IF NOT EXISTS products (
      id SERIAL PRIMARY KEY,
      platform VARCHAR(50) NOT NULL,
      platform_id VARCHAR(255) NOT NULL,
      title VARCHAR(500),
      price DECIMAL(10, 2),
      currency VARCHAR(10),
      sales INTEGER DEFAULT 0,
      status VARCHAR(50),
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(platform, platform_id)
    )
  `);

  return {
    host,
    port,
    container,
  };
}

export async function startRedis(): Promise<ContainerInfo> {
  const { GenericContainer } = await import("testcontainers");

  const container = await new GenericContainer("redis:7-alpine").withExposedPorts(6379).start();

  redisContainer = container;

  const host = container.getHost();
  const port = container.getMappedPort(6379);

  return {
    host,
    port,
    container,
  };
}

export async function stopContainers(): Promise<void> {
  if (containerPool) {
    await containerPool.end();
    containerPool = null;
  }

  if (postgresContainer) {
    await postgresContainer.stop();
    postgresContainer = null;
  }

  if (redisContainer) {
    await redisContainer.stop();
    redisContainer = null;
  }
}

export function getContainerPool(): Pool | null {
  return containerPool;
}

export async function seedProducts(count: number): Promise<void> {
  if (!containerPool) {
    throw new Error("Postgres container not started");
  }

  const { faker } = await import("@faker-js/faker");

  for (let i = 0; i < count; i++) {
    await containerPool.query(
      `INSERT INTO products (platform, platform_id, title, price, currency, sales, status)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [
        "test",
        faker.string.uuid(),
        faker.commerce.productName(),
        parseFloat(faker.commerce.price()),
        "USD",
        faker.number.int({ min: 0, max: 10000 }),
        "active",
      ],
    );
  }
}

export async function cleanDatabase(): Promise<void> {
  if (!containerPool) {
    throw new Error("Postgres container not started");
  }

  await containerPool.query("DELETE FROM products");
}
