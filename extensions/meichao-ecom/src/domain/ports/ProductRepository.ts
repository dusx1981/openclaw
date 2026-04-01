import type { Product } from "../entities/Product.js";
import type { ProductData } from "../types.js";

export interface ProductCreateInput {
  platform: string;
  platformId: string;
  title: string;
  mainImage?: string;
  images?: string[];
  sourceUrl: string;
  price: number;
  originalPrice?: number;
  currency: string;
  sales: number;
  salesUnit?: string;
  salesPeriod: string;
  rating?: number;
  reviewsCount?: number;
  shopId?: string;
  shopName?: string;
  shopUrl?: string;
  categoryId?: string;
  categoryName?: string;
  categoryPath?: string[];
  status: string;
  priority: string;
  isTrending: boolean;
  merchantId?: string;
  tags?: string[];
  extraData?: Record<string, unknown>;
}

export interface ProductUpdateInput {
  title?: string;
  mainImage?: string;
  images?: string[];
  price?: number;
  originalPrice?: number;
  sales?: number;
  salesUnit?: string;
  rating?: number;
  reviewsCount?: number;
  status?: string;
  priority?: string;
  isTrending?: boolean;
  tags?: string[];
  extraData?: Record<string, unknown>;
}

export interface ProductFindManyOptions {
  platform?: string;
  merchantId?: string;
  status?: string;
  priority?: string;
  isTrending?: boolean;
  limit?: number;
  offset?: number;
  orderBy?: string;
}

export interface ProductRepository {
  create(data: ProductCreateInput): Promise<Product>;

  findById(id: number): Promise<Product | null>;

  findByPlatformId(platform: string, platformId: string): Promise<Product | null>;

  findMany(options: ProductFindManyOptions): Promise<Product[]>;

  update(id: number, data: ProductUpdateInput): Promise<Product | null>;

  upsert(data: ProductCreateInput): Promise<Product>;

  delete(id: number): Promise<boolean>;

  count(options?: { platform?: string; merchantId?: string; status?: string }): Promise<number>;

  updatePrice(
    platform: string,
    platformId: string,
    price: number,
    originalPrice?: number,
  ): Promise<Product | null>;

  updateSales(
    platform: string,
    platformId: string,
    sales: number,
    salesUnit?: string,
  ): Promise<Product | null>;

  markTrending(platform: string, platformId: string, isTrending: boolean): Promise<Product | null>;
}
