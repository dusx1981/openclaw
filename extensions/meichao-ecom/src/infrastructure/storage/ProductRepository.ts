import type { PoolClient } from "pg";
import { Product } from "../../domain/entities/Product.js";
import type {
  ProductRepository,
  ProductCreateInput,
  ProductUpdateInput,
  ProductFindManyOptions,
} from "../../domain/ports/ProductRepository.js";
import { query, queryOne, transaction } from "./postgres.js";

interface ProductRow {
  id: number;
  platform: string;
  platform_id: string;
  title: string;
  main_image: string | null;
  images: string[] | null;
  source_url: string;
  price: number;
  original_price: number | null;
  currency: string;
  sales: number;
  sales_unit: string | null;
  sales_period: string;
  rating: number | null;
  reviews_count: number | null;
  shop_id: string | null;
  shop_name: string | null;
  shop_url: string | null;
  category_id: string | null;
  category_name: string | null;
  category_path: string[] | null;
  status: string;
  priority: string;
  is_trending: boolean;
  merchant_id: string | null;
  tags: string[] | null;
  extra_data: Record<string, unknown> | null;
  first_seen_at: Date | null;
  last_seen_at: Date | null;
  price_updated_at: Date | null;
  sales_updated_at: Date | null;
}

function rowToProduct(row: ProductRow): Product {
  const product = Product.create({
    platform: row.platform as never,
    platformId: row.platform_id,
    title: row.title,
    mainImage: row.main_image ?? undefined,
    images: row.images ?? undefined,
    sourceUrl: row.source_url,
    price: row.price,
    originalPrice: row.original_price ?? undefined,
    currency: row.currency,
    sales: row.sales,
    salesUnit: row.sales_unit ?? undefined,
    salesPeriod: row.sales_period as never,
    rating: row.rating ?? undefined,
    reviewsCount: row.reviews_count ?? undefined,
    shopId: row.shop_id ?? undefined,
    shopName: row.shop_name ?? undefined,
    shopUrl: row.shop_url ?? undefined,
    categoryId: row.category_id ?? undefined,
    categoryName: row.category_name ?? undefined,
    categoryPath: row.category_path ?? undefined,
    status: row.status as never,
    priority: row.priority as never,
    isTrending: row.is_trending,
    merchantId: row.merchant_id ?? undefined,
    tags: row.tags ?? undefined,
    extraData: row.extra_data ?? undefined,
  });
  return product.setId(row.id);
}

function inputToRow(
  data: ProductCreateInput,
): Omit<
  ProductRow,
  "id" | "first_seen_at" | "last_seen_at" | "price_updated_at" | "sales_updated_at"
> {
  return {
    platform: data.platform,
    platform_id: data.platformId,
    title: data.title,
    main_image: data.mainImage ?? null,
    images: data.images ?? null,
    source_url: data.sourceUrl,
    price: data.price,
    original_price: data.originalPrice ?? null,
    currency: data.currency,
    sales: data.sales,
    sales_unit: data.salesUnit ?? null,
    sales_period: data.salesPeriod,
    rating: data.rating ?? null,
    reviews_count: data.reviewsCount ?? null,
    shop_id: data.shopId ?? null,
    shop_name: data.shopName ?? null,
    shop_url: data.shopUrl ?? null,
    category_id: data.categoryId ?? null,
    category_name: data.categoryName ?? null,
    category_path: data.categoryPath ?? null,
    status: data.status,
    priority: data.priority,
    is_trending: data.isTrending,
    merchant_id: data.merchantId ?? null,
    tags: data.tags ?? null,
    extra_data: data.extraData ?? null,
  };
}

export class PostgresProductRepository implements ProductRepository {
  async create(data: ProductCreateInput): Promise<Product> {
    const row = inputToRow(data);
    const sql = `
      INSERT INTO products (
        platform, platform_id, title, main_image, images, source_url,
        price, original_price, currency, sales, sales_unit, sales_period,
        rating, reviews_count, shop_id, shop_name, shop_url,
        category_id, category_name, category_path, status, priority, is_trending,
        merchant_id, tags, extra_data
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23, $24, $25, $26)
      RETURNING *
    `;
    const params = [
      row.platform,
      row.platform_id,
      row.title,
      row.main_image,
      row.images,
      row.source_url,
      row.price,
      row.original_price,
      row.currency,
      row.sales,
      row.sales_unit,
      row.sales_period,
      row.rating,
      row.reviews_count,
      row.shop_id,
      row.shop_name,
      row.shop_url,
      row.category_id,
      row.category_name,
      row.category_path,
      row.status,
      row.priority,
      row.is_trending,
      row.merchant_id,
      row.tags,
      row.extra_data,
    ];
    const result = await queryOne<ProductRow>(sql, params);
    if (!result) {
      throw new Error("Failed to create product");
    }
    return rowToProduct(result);
  }

  async findById(id: number): Promise<Product | null> {
    const sql = "SELECT * FROM products WHERE id = $1";
    const row = await queryOne<ProductRow>(sql, [id]);
    return row ? rowToProduct(row) : null;
  }

  async findByPlatformId(platform: string, platformId: string): Promise<Product | null> {
    const sql = "SELECT * FROM products WHERE platform = $1 AND platform_id = $2";
    const row = await queryOne<ProductRow>(sql, [platform, platformId]);
    return row ? rowToProduct(row) : null;
  }

  async findMany(options: ProductFindManyOptions): Promise<Product[]> {
    const conditions: string[] = [];
    const params: unknown[] = [];
    let paramIndex = 1;

    if (options.platform) {
      conditions.push(`platform = $${paramIndex++}`);
      params.push(options.platform);
    }
    if (options.merchantId) {
      conditions.push(`merchant_id = $${paramIndex++}`);
      params.push(options.merchantId);
    }
    if (options.status) {
      conditions.push(`status = $${paramIndex++}`);
      params.push(options.status);
    }
    if (options.priority) {
      conditions.push(`priority = $${paramIndex++}`);
      params.push(options.priority);
    }
    if (options.isTrending !== undefined) {
      conditions.push(`is_trending = $${paramIndex++}`);
      params.push(options.isTrending);
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";
    const orderBy = options.orderBy ?? "last_seen_at DESC";
    const limit = options.limit ?? 100;
    const offset = options.offset ?? 0;

    const sql = `SELECT * FROM products ${whereClause} ORDER BY ${orderBy} LIMIT $${paramIndex++} OFFSET $${paramIndex}`;
    params.push(limit, offset);

    const rows = await query<ProductRow>(sql, params);
    return rows.map(rowToProduct);
  }

  async update(id: number, data: ProductUpdateInput): Promise<Product | null> {
    const updates: string[] = [];
    const params: unknown[] = [];
    let paramIndex = 1;

    const fieldMap: Record<keyof ProductUpdateInput, string> = {
      title: "title",
      mainImage: "main_image",
      images: "images",
      price: "price",
      originalPrice: "original_price",
      sales: "sales",
      salesUnit: "sales_unit",
      rating: "rating",
      reviewsCount: "reviews_count",
      status: "status",
      priority: "priority",
      isTrending: "is_trending",
      tags: "tags",
      extraData: "extra_data",
    };

    for (const [key, value] of Object.entries(data)) {
      if (value !== undefined) {
        const columnName = fieldMap[key as keyof ProductUpdateInput];
        updates.push(`${columnName} = $${paramIndex++}`);
        params.push(value);
      }
    }

    if (updates.length === 0) {
      return this.findById(id);
    }

    updates.push(`last_seen_at = $${paramIndex++}`);
    params.push(new Date());

    params.push(id);
    const sql = `UPDATE products SET ${updates.join(", ")} WHERE id = $${paramIndex} RETURNING *`;

    const row = await queryOne<ProductRow>(sql, params);
    return row ? rowToProduct(row) : null;
  }

  async upsert(data: ProductCreateInput): Promise<Product> {
    const row = inputToRow(data);
    const sql = `
      INSERT INTO products (
        platform, platform_id, title, main_image, images, source_url,
        price, original_price, currency, sales, sales_unit, sales_period,
        rating, reviews_count, shop_id, shop_name, shop_url,
        category_id, category_name, category_path, status, priority, is_trending,
        merchant_id, tags, extra_data
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23, $24, $25, $26)
      ON CONFLICT (platform, platform_id) DO UPDATE SET
        title = EXCLUDED.title,
        main_image = COALESCE(EXCLUDED.main_image, products.main_image),
        images = COALESCE(EXCLUDED.images, products.images),
        price = EXCLUDED.price,
        original_price = COALESCE(EXCLUDED.original_price, products.original_price),
        sales = EXCLUDED.sales,
        rating = COALESCE(EXCLUDED.rating, products.rating),
        reviews_count = COALESCE(EXCLUDED.reviews_count, products.reviews_count),
        status = EXCLUDED.status,
        is_trending = EXCLUDED.is_trending,
        extra_data = COALESCE(EXCLUDED.extra_data, products.extra_data),
        last_seen_at = NOW()
      RETURNING *
    `;
    const params = [
      row.platform,
      row.platform_id,
      row.title,
      row.main_image,
      row.images,
      row.source_url,
      row.price,
      row.original_price,
      row.currency,
      row.sales,
      row.sales_unit,
      row.sales_period,
      row.rating,
      row.reviews_count,
      row.shop_id,
      row.shop_name,
      row.shop_url,
      row.category_id,
      row.category_name,
      row.category_path,
      row.status,
      row.priority,
      row.is_trending,
      row.merchant_id,
      row.tags,
      row.extra_data,
    ];
    const result = await queryOne<ProductRow>(sql, params);
    if (!result) {
      throw new Error("Failed to upsert product");
    }
    return rowToProduct(result);
  }

  async delete(id: number): Promise<boolean> {
    const sql = "DELETE FROM products WHERE id = $1";
    const result = await query(sql, [id]);
    return result.length > 0;
  }

  async count(options?: {
    platform?: string;
    merchantId?: string;
    status?: string;
  }): Promise<number> {
    const conditions: string[] = [];
    const params: unknown[] = [];
    let paramIndex = 1;

    if (options?.platform) {
      conditions.push(`platform = $${paramIndex++}`);
      params.push(options.platform);
    }
    if (options?.merchantId) {
      conditions.push(`merchant_id = $${paramIndex++}`);
      params.push(options.merchantId);
    }
    if (options?.status) {
      conditions.push(`status = $${paramIndex++}`);
      params.push(options.status);
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";
    const sql = `SELECT COUNT(*)::int as count FROM products ${whereClause}`;
    const result = await queryOne<{ count: number }>(sql, params);
    return result?.count ?? 0;
  }

  async updatePrice(
    platform: string,
    platformId: string,
    price: number,
    originalPrice?: number,
  ): Promise<Product | null> {
    const updates = ["price = $3", "price_updated_at = NOW()", "last_seen_at = NOW()"];
    const params: unknown[] = [platform, platformId, price];

    if (originalPrice !== undefined) {
      updates.push("original_price = $4");
      params.push(originalPrice);
    }

    const sql = `UPDATE products SET ${updates.join(", ")} WHERE platform = $1 AND platform_id = $2 RETURNING *`;
    const row = await queryOne<ProductRow>(sql, params);
    return row ? rowToProduct(row) : null;
  }

  async updateSales(
    platform: string,
    platformId: string,
    sales: number,
    salesUnit?: string,
  ): Promise<Product | null> {
    const updates = ["sales = $3", "sales_updated_at = NOW()", "last_seen_at = NOW()"];
    const params: unknown[] = [platform, platformId, sales];

    if (salesUnit !== undefined) {
      updates.push("sales_unit = $4");
      params.push(salesUnit);
    }

    const sql = `UPDATE products SET ${updates.join(", ")} WHERE platform = $1 AND platform_id = $2 RETURNING *`;
    const row = await queryOne<ProductRow>(sql, params);
    return row ? rowToProduct(row) : null;
  }

  async markTrending(
    platform: string,
    platformId: string,
    isTrending: boolean,
  ): Promise<Product | null> {
    const sql = `
      UPDATE products 
      SET is_trending = $3, priority = CASE WHEN $3 THEN 'P0' ELSE priority END, last_seen_at = NOW()
      WHERE platform = $1 AND platform_id = $2 
      RETURNING *
    `;
    const row = await queryOne<ProductRow>(sql, [platform, platformId, isTrending]);
    return row ? rowToProduct(row) : null;
  }

  async withTransaction<T>(
    fn: (repo: ProductRepository, client: PoolClient) => Promise<T>,
  ): Promise<T> {
    return transaction(async (client) => {
      const txRepo = new TransactionalProductRepository(client);
      return fn(txRepo, client);
    });
  }
}

class TransactionalProductRepository implements ProductRepository {
  constructor(private client: PoolClient) {}

  async create(data: ProductCreateInput): Promise<Product> {
    const repo = new PostgresProductRepository();
    return repo.create(data);
  }

  async findById(id: number): Promise<Product | null> {
    const sql = "SELECT * FROM products WHERE id = $1";
    const result = await this.client.query(sql, [id]);
    return result.rows[0] ? rowToProduct(result.rows[0]) : null;
  }

  async findByPlatformId(platform: string, platformId: string): Promise<Product | null> {
    const sql = "SELECT * FROM products WHERE platform = $1 AND platform_id = $2";
    const result = await this.client.query(sql, [platform, platformId]);
    return result.rows[0] ? rowToProduct(result.rows[0]) : null;
  }

  async findMany(options: ProductFindManyOptions): Promise<Product[]> {
    const repo = new PostgresProductRepository();
    return repo.findMany(options);
  }

  async update(id: number, data: ProductUpdateInput): Promise<Product | null> {
    const repo = new PostgresProductRepository();
    return repo.update(id, data);
  }

  async upsert(data: ProductCreateInput): Promise<Product> {
    const repo = new PostgresProductRepository();
    return repo.upsert(data);
  }

  async delete(id: number): Promise<boolean> {
    const sql = "DELETE FROM products WHERE id = $1";
    const result = await this.client.query(sql, [id]);
    return result.rowCount !== null && result.rowCount > 0;
  }

  async count(options?: {
    platform?: string;
    merchantId?: string;
    status?: string;
  }): Promise<number> {
    const repo = new PostgresProductRepository();
    return repo.count(options);
  }

  async updatePrice(
    platform: string,
    platformId: string,
    price: number,
    originalPrice?: number,
  ): Promise<Product | null> {
    const repo = new PostgresProductRepository();
    return repo.updatePrice(platform, platformId, price, originalPrice);
  }

  async updateSales(
    platform: string,
    platformId: string,
    sales: number,
    salesUnit?: string,
  ): Promise<Product | null> {
    const repo = new PostgresProductRepository();
    return repo.updateSales(platform, platformId, sales, salesUnit);
  }

  async markTrending(
    platform: string,
    platformId: string,
    isTrending: boolean,
  ): Promise<Product | null> {
    const repo = new PostgresProductRepository();
    return repo.markTrending(platform, platformId, isTrending);
  }
}
