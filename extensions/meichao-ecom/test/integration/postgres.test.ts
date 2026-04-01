import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import {
  startPostgres,
  stopContainers,
  getContainerPool,
  seedProducts,
  cleanDatabase,
  shouldRunIntegrationTest,
  SKIP_INTEGRATION,
} from "../helpers/database.js";

const describeIntegration = SKIP_INTEGRATION ? describe.skip : describe;

describeIntegration("PostgreSQL Integration", () => {
  beforeAll(async () => {
    if (!shouldRunIntegrationTest()) return;
    await startPostgres();
  }, 60000);

  afterAll(async () => {
    if (!shouldRunIntegrationTest()) return;
    await stopContainers();
  }, 30000);

  beforeEach(async () => {
    if (!shouldRunIntegrationTest()) return;
    await cleanDatabase();
  });

  it("should connect to postgres container", async () => {
    const pool = getContainerPool();
    expect(pool).toBeDefined();

    const result = await pool!.query("SELECT 1 as value");
    expect(result.rows[0].value).toBe(1);
  });

  it("should create and query products table", async () => {
    const pool = getContainerPool();

    await pool!.query(
      `INSERT INTO products (platform, platform_id, title, price, currency, sales, status)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      ["test", "test-1", "Test Product", 99.99, "USD", 100, "active"],
    );

    const result = await pool!.query("SELECT * FROM products WHERE platform = 'test'");
    expect(result.rows).toHaveLength(1);
    expect(result.rows[0].title).toBe("Test Product");
  });

  it("should seed products", async () => {
    await seedProducts(10);

    const pool = getContainerPool();
    const result = await pool!.query("SELECT * FROM products WHERE platform = 'test'");
    expect(result.rows).toHaveLength(10);
  });

  it("should clean database", async () => {
    await seedProducts(5);

    const pool = getContainerPool();
    let result = await pool!.query("SELECT * FROM products WHERE platform = 'test'");
    expect(result.rows).toHaveLength(5);

    await cleanDatabase();

    result = await pool!.query("SELECT * FROM products WHERE platform = 'test'");
    expect(result.rows).toHaveLength(0);
  });

  it("should handle unique constraint", async () => {
    const pool = getContainerPool();

    await pool!.query(
      `INSERT INTO products (platform, platform_id, title, price, currency, sales, status)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      ["test", "unique-1", "Product 1", 10.0, "USD", 0, "active"],
    );

    await expect(
      pool!.query(
        `INSERT INTO products (platform, platform_id, title, price, currency, sales, status)
         VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        ["test", "unique-1", "Product 2", 20.0, "USD", 0, "active"],
      ),
    ).rejects.toThrow();
  });
});
