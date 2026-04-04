import pg from "pg";
import { describe, it, expect, beforeEach, afterEach, vi, Mock } from "vitest";
import type {
  ProductCreateInput,
  ProductUpdateInput,
} from "../../domain/ports/ProductRepository.js";
import { query, queryOne } from "./postgres.js";
import { PostgresProductRepository } from "./ProductRepository.js";
import { TransactionManager } from "./TransactionManager.js";

vi.mock("./postgres.js", () => ({
  getPool: vi.fn(),
  query: vi.fn(),
  queryOne: vi.fn(),
}));

interface MockPool {
  connect: Mock;
}

interface MockClient {
  query: Mock;
  release: Mock;
}

const createMockClient = (): MockClient => {
  const mockQuery = vi.fn();
  const mockRelease = vi.fn();

  return {
    query: mockQuery,
    release: mockRelease,
  };
};

const createMockPool = (mockClient: MockClient): MockPool => ({
  connect: vi.fn().mockResolvedValue(mockClient),
});

describe("PostgresProductRepository", () => {
  let repository: PostgresProductRepository;
  let mockClient: MockClient;
  let mockPool: MockPool;
  let transactionManager: TransactionManager;

  beforeEach(async () => {
    vi.clearAllMocks();

    mockClient = createMockClient();
    mockPool = createMockPool(mockClient);

    const postgres = await import("./postgres.js");
    vi.spyOn(postgres, "getPool").mockReturnValue(mockPool as any);
    vi.spyOn(postgres, "query").mockImplementation(async (sql: string, params?: unknown[]) => {
      return mockClient.query(sql, params);
    });
    vi.spyOn(postgres, "queryOne").mockImplementation(async (sql: string, params?: unknown[]) => {
      const result = await mockClient.query(sql, params);
      return result.rows?.[0] ?? null;
    });

    transactionManager = new TransactionManager();
    repository = new PostgresProductRepository(transactionManager);
  });

  afterEach(async () => {
    vi.restoreAllMocks();
  });

  const createTestProductInput = (): ProductCreateInput => ({
    platform: "taobao",
    platformId: "12345",
    title: "Test Product",
    sourceUrl: "https://example.com/product/12345",
    price: 99.99,
    currency: "CNY",
    sales: 100,
    salesPeriod: "monthly",
    status: "active",
    priority: "P1",
    isTrending: false,
  });

  describe("createMany", () => {
    it("should create multiple products in a single transaction", async () => {
      const items = [
        createTestProductInput(),
        { ...createTestProductInput(), platformId: "12346" },
        { ...createTestProductInput(), platformId: "12347" },
      ];

      mockClient.query.mockImplementation(async (sql: string) => {
        if (sql === "BEGIN" || sql.includes("SET TRANSACTION") || sql === "COMMIT") {
          return { rows: [] };
        }
        if (sql.includes("INSERT")) {
          const platformId = sql.match(/VALUES.*\$2/);
          return {
            rows: [
              {
                id: Math.floor(Math.random() * 1000),
                platform: "taobao",
                platform_id: items.find((i) => i.platformId !== "12345")?.platformId ?? "12345",
                title: "Test Product",
                main_image: null,
                images: null,
                source_url: "https://example.com/product/12345",
                price: 99.99,
                original_price: null,
                currency: "CNY",
                sales: 100,
                sales_unit: null,
                sales_period: "monthly",
                rating: null,
                reviews_count: null,
                shop_id: null,
                shop_name: null,
                shop_url: null,
                category_id: null,
                category_name: null,
                category_path: null,
                status: "active",
                priority: "P1",
                is_trending: false,
                merchant_id: null,
                tags: null,
                extra_data: null,
                first_seen_at: new Date(),
                last_seen_at: new Date(),
                price_updated_at: null,
                sales_updated_at: null,
              },
            ],
          };
        }
        return { rows: [] };
      });

      const products = await repository.createMany(items);

      expect(products).toHaveLength(3);
      expect(mockClient.query).toHaveBeenCalledWith("BEGIN");
      expect(mockClient.query).toHaveBeenCalledWith("COMMIT");
      expect(mockClient.release).toHaveBeenCalled();
    });

    it("should rollback on error during batch creation", async () => {
      const items = [
        createTestProductInput(),
        { ...createTestProductInput(), platformId: "12346" },
      ];

      let insertCount = 0;
      mockClient.query.mockImplementation(async (sql: string) => {
        if (sql === "BEGIN" || sql.includes("SET TRANSACTION")) {
          return { rows: [] };
        }
        if (sql.includes("INSERT")) {
          insertCount++;
          if (insertCount === 2) {
            throw new Error("Database error");
          }
          return {
            rows: [
              {
                id: 1,
                platform: "taobao",
                platform_id: "12345",
                title: "Test Product",
                main_image: null,
                images: null,
                source_url: "https://example.com/product/12345",
                price: 99.99,
                original_price: null,
                currency: "CNY",
                sales: 100,
                sales_unit: null,
                sales_period: "monthly",
                rating: null,
                reviews_count: null,
                shop_id: null,
                shop_name: null,
                shop_url: null,
                category_id: null,
                category_name: null,
                category_path: null,
                status: "active",
                priority: "P1",
                is_trending: false,
                merchant_id: null,
                tags: null,
                extra_data: null,
                first_seen_at: new Date(),
                last_seen_at: new Date(),
                price_updated_at: null,
                sales_updated_at: null,
              },
            ],
          };
        }
        return { rows: [] };
      });

      await expect(repository.createMany(items)).rejects.toThrow("Database error");

      expect(mockClient.query).toHaveBeenCalledWith("ROLLBACK");
      expect(mockClient.release).toHaveBeenCalled();
    });
  });

  describe("updateMany", () => {
    it("should update multiple products in a single transaction", async () => {
      const updates = [
        { id: 1, data: { price: 89.99 } },
        { id: 2, data: { price: 79.99 } },
        { id: 3, data: { status: "inactive" } },
      ];

      mockClient.query.mockImplementation(async (sql: string) => {
        if (sql === "BEGIN" || sql.includes("SET TRANSACTION") || sql === "COMMIT") {
          return { rows: [] };
        }
        if (sql.includes("UPDATE")) {
          return {
            rows: [
              {
                id: parseInt(sql.match(/WHERE id = \$(\d+)/)?.[1] ?? "1"),
                platform: "taobao",
                platform_id: "12345",
                title: "Test Product",
                main_image: null,
                images: null,
                source_url: "https://example.com/product/12345",
                price: 89.99,
                original_price: null,
                currency: "CNY",
                sales: 100,
                sales_unit: null,
                sales_period: "monthly",
                rating: null,
                reviews_count: null,
                shop_id: null,
                shop_name: null,
                shop_url: null,
                category_id: null,
                category_name: null,
                category_path: null,
                status: "active",
                priority: "P1",
                is_trending: false,
                merchant_id: null,
                tags: null,
                extra_data: null,
                first_seen_at: new Date(),
                last_seen_at: new Date(),
                price_updated_at: null,
                sales_updated_at: null,
              },
            ],
          };
        }
        return { rows: [] };
      });

      const products = await repository.updateMany(updates);

      expect(products.length).toBeGreaterThan(0);
      expect(mockClient.query).toHaveBeenCalledWith("BEGIN");
      expect(mockClient.query).toHaveBeenCalledWith("COMMIT");
      expect(mockClient.release).toHaveBeenCalled();
    });

    it("should rollback on error during batch update", async () => {
      const updates = [
        { id: 1, data: { price: 89.99 } },
        { id: 2, data: { price: 79.99 } },
      ];

      let updateCount = 0;
      mockClient.query.mockImplementation(async (sql: string) => {
        if (sql === "BEGIN" || sql.includes("SET TRANSACTION")) {
          return { rows: [] };
        }
        if (sql.includes("UPDATE")) {
          updateCount++;
          if (updateCount === 2) {
            throw new Error("Update failed");
          }
          return {
            rows: [
              {
                id: 1,
                platform: "taobao",
                platform_id: "12345",
                title: "Test Product",
                price: 89.99,
                status: "active",
              },
            ],
          };
        }
        return { rows: [] };
      });

      await expect(repository.updateMany(updates)).rejects.toThrow("Update failed");

      expect(mockClient.query).toHaveBeenCalledWith("ROLLBACK");
      expect(mockClient.release).toHaveBeenCalled();
    });
  });

  describe("deleteMany", () => {
    it("should delete multiple products in a single transaction", async () => {
      const ids = [1, 2, 3];

      mockClient.query.mockImplementation(async (sql: string) => {
        if (sql === "BEGIN" || sql.includes("SET TRANSACTION") || sql === "COMMIT") {
          return { rows: [] };
        }
        if (sql.includes("DELETE")) {
          return { rowCount: 1 };
        }
        return { rows: [] };
      });

      const result = await repository.deleteMany(ids);

      expect(result).toBe(true);
      expect(mockClient.query).toHaveBeenCalledWith("BEGIN");
      expect(mockClient.query).toHaveBeenCalledWith("COMMIT");
      expect(mockClient.release).toHaveBeenCalled();
    });

    it("should rollback on error during batch deletion", async () => {
      const ids = [1, 2];

      let deleteCount = 0;
      mockClient.query.mockImplementation(async (sql: string) => {
        if (sql === "BEGIN" || sql.includes("SET TRANSACTION")) {
          return { rows: [] };
        }
        if (sql.includes("DELETE")) {
          deleteCount++;
          if (deleteCount === 2) {
            throw new Error("Delete failed");
          }
          return { rowCount: 1 };
        }
        return { rows: [] };
      });

      await expect(repository.deleteMany(ids)).rejects.toThrow("Delete failed");

      expect(mockClient.query).toHaveBeenCalledWith("ROLLBACK");
      expect(mockClient.release).toHaveBeenCalled();
    });
  });

  describe("Transaction isolation", () => {
    it("should use READ COMMITTED isolation level by default", async () => {
      mockClient.query.mockImplementation(async (sql: string) => {
        if (sql === "BEGIN" || sql.includes("SET TRANSACTION") || sql === "COMMIT") {
          return { rows: [] };
        }
        if (sql.includes("INSERT")) {
          return {
            rows: [
              {
                id: 1,
                platform: "taobao",
                platform_id: "12345",
                title: "Test Product",
                main_image: null,
                images: null,
                source_url: "https://example.com/product/12345",
                price: 99.99,
                original_price: null,
                currency: "CNY",
                sales: 100,
                sales_unit: null,
                sales_period: "monthly",
                rating: null,
                reviews_count: null,
                shop_id: null,
                shop_name: null,
                shop_url: null,
                category_id: null,
                category_name: null,
                category_path: null,
                status: "active",
                priority: "P1",
                is_trending: false,
                merchant_id: null,
                tags: null,
                extra_data: null,
                first_seen_at: new Date(),
                last_seen_at: new Date(),
                price_updated_at: null,
                sales_updated_at: null,
              },
            ],
          };
        }
        return { rows: [] };
      });

      await repository.createMany([createTestProductInput()]);

      expect(mockClient.query).toHaveBeenCalledWith(
        "SET TRANSACTION ISOLATION LEVEL READ COMMITTED",
      );
    });
  });

  describe("Performance", () => {
    it("should handle large batch operations efficiently", async () => {
      const items = Array.from({ length: 100 }, (_, i) => ({
        ...createTestProductInput(),
        platformId: `product-${i}`,
      }));

      mockClient.query.mockImplementation(async (sql: string) => {
        if (sql === "BEGIN" || sql.includes("SET TRANSACTION") || sql === "COMMIT") {
          return { rows: [] };
        }
        if (sql.includes("INSERT")) {
          return {
            rows: [
              {
                id: Math.floor(Math.random() * 1000),
                platform: "taobao",
                platform_id: "test",
                title: "Test",
                main_image: null,
                images: null,
                source_url: "url",
                price: 99.99,
                original_price: null,
                currency: "CNY",
                sales: 100,
                sales_unit: null,
                sales_period: "monthly",
                rating: null,
                reviews_count: null,
                shop_id: null,
                shop_name: null,
                shop_url: null,
                category_id: null,
                category_name: null,
                category_path: null,
                status: "active",
                priority: "P1",
                is_trending: false,
                merchant_id: null,
                tags: null,
                extra_data: null,
                first_seen_at: new Date(),
                last_seen_at: new Date(),
                price_updated_at: null,
                sales_updated_at: null,
              },
            ],
          };
        }
        return { rows: [] };
      });

      const start = Date.now();
      const products = await repository.createMany(items);
      const duration = Date.now() - start;

      expect(products).toHaveLength(100);
      expect(duration).toBeLessThan(5000);
      expect(mockClient.query).toHaveBeenCalledWith("BEGIN");
      expect(mockClient.query).toHaveBeenCalledWith("COMMIT");
    });
  });
});
