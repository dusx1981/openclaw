import { describe, it, expect, vi, beforeEach } from "vitest";
import type { ProductCreateInput, ProductUpdateInput } from "../domain/ports/ProductRepository.js";

vi.mock("../storage/postgres.js", () => ({
  query: vi.fn(),
  queryOne: vi.fn(),
  transaction: vi.fn(),
}));

describe("PostgresProductRepository", () => {
  let repo: import("../storage/ProductRepository.js").PostgresProductRepository;
  let postgres: typeof import("../storage/postgres.js");

  const mockProductRow = {
    id: 1,
    platform: "taobao",
    platform_id: "12345",
    title: "Test Product",
    main_image: "https://example.com/image.jpg",
    images: ["https://example.com/image1.jpg"],
    source_url: "https://item.taobao.com/12345",
    price: 99.99,
    original_price: 199.99,
    currency: "CNY",
    sales: 1000,
    sales_unit: "件",
    sales_period: "30d",
    rating: 4.8,
    reviews_count: 500,
    shop_id: "shop1",
    shop_name: "Test Shop",
    shop_url: "https://shop.taobao.com/shop1",
    category_id: "cat1",
    category_name: "Electronics",
    category_path: ["Home", "Electronics"],
    status: "active",
    priority: "P1",
    is_trending: false,
    merchant_id: "merchant1",
    tags: ["tag1", "tag2"],
    extra_data: { custom: "data" },
    first_seen_at: new Date(),
    last_seen_at: new Date(),
    price_updated_at: null,
    sales_updated_at: null,
  };

  const mockCreateInput: ProductCreateInput = {
    platform: "taobao",
    platformId: "12345",
    title: "Test Product",
    mainImage: "https://example.com/image.jpg",
    images: ["https://example.com/image1.jpg"],
    sourceUrl: "https://item.taobao.com/12345",
    price: 99.99,
    originalPrice: 199.99,
    currency: "CNY",
    sales: 1000,
    salesUnit: "件",
    salesPeriod: "30d",
    rating: 4.8,
    reviewsCount: 500,
    shopId: "shop1",
    shopName: "Test Shop",
    shopUrl: "https://shop.taobao.com/shop1",
    categoryId: "cat1",
    categoryName: "Electronics",
    categoryPath: ["Home", "Electronics"],
    status: "active",
    priority: "P1",
    isTrending: false,
    merchantId: "merchant1",
    tags: ["tag1", "tag2"],
    extraData: { custom: "data" },
  };

  beforeEach(async () => {
    vi.clearAllMocks();
    postgres = await import("../storage/postgres.js");
    const { PostgresProductRepository } = await import("../storage/ProductRepository.js");
    repo = new PostgresProductRepository();
  });

  describe("create", () => {
    it("should create a product and return it", async () => {
      (postgres.queryOne as ReturnType<typeof vi.fn>).mockResolvedValue(mockProductRow);

      const result = await repo.create(mockCreateInput);

      expect(postgres.queryOne).toHaveBeenCalledWith(
        expect.stringContaining("INSERT INTO products"),
        expect.arrayContaining([
          mockCreateInput.platform,
          mockCreateInput.platformId,
          mockCreateInput.title,
        ]),
      );
      expect(result.id).toBe(1);
      expect(result.platform).toBe("taobao");
      expect(result.title).toBe("Test Product");
    });

    it("should throw error if creation fails", async () => {
      (postgres.queryOne as ReturnType<typeof vi.fn>).mockResolvedValue(null);

      await expect(repo.create(mockCreateInput)).rejects.toThrow("Failed to create product");
    });
  });

  describe("findById", () => {
    it("should return product if found", async () => {
      (postgres.queryOne as ReturnType<typeof vi.fn>).mockResolvedValue(mockProductRow);

      const result = await repo.findById(1);

      expect(postgres.queryOne).toHaveBeenCalledWith("SELECT * FROM products WHERE id = $1", [1]);
      expect(result).not.toBeNull();
      expect(result?.id).toBe(1);
    });

    it("should return null if not found", async () => {
      (postgres.queryOne as ReturnType<typeof vi.fn>).mockResolvedValue(null);

      const result = await repo.findById(999);

      expect(result).toBeNull();
    });
  });

  describe("findByPlatformId", () => {
    it("should return product by platform and platform_id", async () => {
      (postgres.queryOne as ReturnType<typeof vi.fn>).mockResolvedValue(mockProductRow);

      const result = await repo.findByPlatformId("taobao", "12345");

      expect(postgres.queryOne).toHaveBeenCalledWith(
        "SELECT * FROM products WHERE platform = $1 AND platform_id = $2",
        ["taobao", "12345"],
      );
      expect(result).not.toBeNull();
    });

    it("should return null if not found", async () => {
      (postgres.queryOne as ReturnType<typeof vi.fn>).mockResolvedValue(null);

      const result = await repo.findByPlatformId("taobao", "nonexistent");

      expect(result).toBeNull();
    });
  });

  describe("findMany", () => {
    it("should return products with filters", async () => {
      (postgres.query as ReturnType<typeof vi.fn>).mockResolvedValue([mockProductRow]);

      const result = await repo.findMany({
        platform: "taobao",
        status: "active",
        limit: 10,
        offset: 0,
      });

      expect(postgres.query).toHaveBeenCalled();
      expect(result).toHaveLength(1);
      expect(result[0].platform).toBe("taobao");
    });

    it("should return all products without filters", async () => {
      (postgres.query as ReturnType<typeof vi.fn>).mockResolvedValue([mockProductRow]);

      const result = await repo.findMany({});

      expect(postgres.query).toHaveBeenCalled();
      expect(result).toHaveLength(1);
    });
  });

  describe("update", () => {
    it("should update product fields", async () => {
      (postgres.queryOne as ReturnType<typeof vi.fn>).mockResolvedValue({
        ...mockProductRow,
        title: "Updated Title",
        price: 149.99,
      });

      const updateData: ProductUpdateInput = {
        title: "Updated Title",
        price: 149.99,
      };

      const result = await repo.update(1, updateData);

      expect(postgres.queryOne).toHaveBeenCalledWith(
        expect.stringContaining("UPDATE products SET"),
        expect.arrayContaining([1]),
      );
      expect(result).not.toBeNull();
    });

    it("should return product without update if no fields", async () => {
      (postgres.queryOne as ReturnType<typeof vi.fn>).mockResolvedValue(mockProductRow);

      const result = await repo.update(1, {});

      expect(result).not.toBeNull();
    });
  });

  describe("upsert", () => {
    it("should insert or update product", async () => {
      (postgres.queryOne as ReturnType<typeof vi.fn>).mockResolvedValue(mockProductRow);

      const result = await repo.upsert(mockCreateInput);

      expect(postgres.queryOne).toHaveBeenCalledWith(
        expect.stringContaining("ON CONFLICT"),
        expect.arrayContaining([mockCreateInput.platform, mockCreateInput.platformId]),
      );
      expect(result.id).toBe(1);
    });
  });

  describe("delete", () => {
    it("should delete product and return true", async () => {
      (postgres.query as ReturnType<typeof vi.fn>).mockResolvedValue([mockProductRow]);

      const result = await repo.delete(1);

      expect(postgres.query).toHaveBeenCalledWith("DELETE FROM products WHERE id = $1", [1]);
      expect(result).toBe(true);
    });

    it("should return false if product not found", async () => {
      (postgres.query as ReturnType<typeof vi.fn>).mockResolvedValue([]);

      const result = await repo.delete(999);

      expect(result).toBe(false);
    });
  });

  describe("count", () => {
    it("should return count of products", async () => {
      (postgres.queryOne as ReturnType<typeof vi.fn>).mockResolvedValue({ count: 42 });

      const result = await repo.count();

      expect(postgres.queryOne).toHaveBeenCalledWith(expect.stringContaining("COUNT(*)"), []);
      expect(result).toBe(42);
    });

    it("should return count with filters", async () => {
      (postgres.queryOne as ReturnType<typeof vi.fn>).mockResolvedValue({ count: 10 });

      const result = await repo.count({ platform: "taobao", status: "active" });

      expect(postgres.queryOne).toHaveBeenCalledWith(expect.stringContaining("WHERE"), [
        "taobao",
        "active",
      ]);
      expect(result).toBe(10);
    });
  });

  describe("updatePrice", () => {
    it("should update product price", async () => {
      (postgres.queryOne as ReturnType<typeof vi.fn>).mockResolvedValue({
        ...mockProductRow,
        price: 79.99,
      });

      const result = await repo.updatePrice("taobao", "12345", 79.99);

      expect(postgres.queryOne).toHaveBeenCalledWith(expect.stringContaining("price ="), [
        "taobao",
        "12345",
        79.99,
      ]);
      expect(result).not.toBeNull();
    });

    it("should update price and original price", async () => {
      (postgres.queryOne as ReturnType<typeof vi.fn>).mockResolvedValue({
        ...mockProductRow,
        price: 79.99,
        original_price: 99.99,
      });

      const result = await repo.updatePrice("taobao", "12345", 79.99, 99.99);

      expect(result).not.toBeNull();
    });
  });

  describe("updateSales", () => {
    it("should update product sales", async () => {
      (postgres.queryOne as ReturnType<typeof vi.fn>).mockResolvedValue({
        ...mockProductRow,
        sales: 2000,
      });

      const result = await repo.updateSales("taobao", "12345", 2000);

      expect(postgres.queryOne).toHaveBeenCalledWith(expect.stringContaining("sales ="), [
        "taobao",
        "12345",
        2000,
      ]);
      expect(result).not.toBeNull();
    });
  });

  describe("markTrending", () => {
    it("should mark product as trending", async () => {
      (postgres.queryOne as ReturnType<typeof vi.fn>).mockResolvedValue({
        ...mockProductRow,
        is_trending: true,
        priority: "P0",
      });

      const result = await repo.markTrending("taobao", "12345", true);

      expect(postgres.queryOne).toHaveBeenCalledWith(expect.stringContaining("is_trending ="), [
        "taobao",
        "12345",
        true,
      ]);
      expect(result).not.toBeNull();
    });
  });
});
