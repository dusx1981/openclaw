import type { ProductData } from "../../../domain/types.js";
import type { TikTokShopClient } from "./TikTokShopClient.js";

export interface TikTokShopProductDetail {
  product_id: string;
  title: string;
  price: number;
  original_price?: number;
  main_image: string;
  images?: string[];
  description?: string;
  category_id: string;
  shop_id: string;
  shop_name?: string;
  status: string;
  sales?: number;
  rating?: number;
  shop_region?: string;
  creator_id?: string;
  creator_name?: string;
  live_id?: string;
  live_price?: number;
}

export interface TikTokShopSearchItem {
  product_id: string;
  title: string;
  price: number;
  main_image: string;
  sales?: number;
  shop_region?: string;
}

export interface TikTokShopProductList {
  products: TikTokShopSearchItem[];
  total: number;
  has_more: boolean;
}

export class TikTokShopProductApi {
  constructor(private client: TikTokShopClient) {}

  async getProductDetail(productId: string): Promise<ProductData | null> {
    try {
      const result = await this.client.execute<{ product: TikTokShopProductDetail }>({
        method: "GET",
        path: "/api/products/detail",
        params: {
          product_id: productId,
        },
      });

      if (!result?.product) {
        return null;
      }

      return this.mapToProductData(result.product);
    } catch (error) {
      console.error(`Failed to fetch TikTok Shop product ${productId}:`, error);
      throw error;
    }
  }

  async searchProducts(
    keyword: string,
    page = 1,
    pageSize = 20,
  ): Promise<{
    products: ProductData[];
    total: number;
    page: number;
  }> {
    try {
      const result = await this.client.execute<TikTokShopProductList>({
        method: "GET",
        path: "/api/products/search",
        params: {
          keyword,
          page_number: page,
          page_size: pageSize,
        },
      });

      const items = result?.products ?? [];
      const total = result?.total ?? 0;

      return {
        products: items.map((item) => this.mapSearchItemToProductData(item)),
        total,
        page,
      };
    } catch (error) {
      console.error(`Failed to search TikTok Shop products with keyword "${keyword}":`, error);
      throw error;
    }
  }

  private mapToProductData(item: TikTokShopProductDetail): ProductData {
    return {
      platform: "tiktok_shop",
      platformId: item.product_id,
      title: item.title,
      mainImage: item.main_image,
      sourceUrl: `https://shop.tiktok.com/product/${item.product_id}`,
      price: item.price,
      originalPrice: item.original_price,
      currency: "USD",
      sales: item.sales ?? 0,
      salesPeriod: "month",
      status: this.mapStatus(item.status),
      priority: "P1",
      isTrending: (item.sales ?? 0) > 1000,
      categoryId: item.category_id,
      shopName: item.shop_name,
      extraData: {
        shopRegion: item.shop_region ?? this.client.getRegion(),
        tiktokShopId: item.shop_id,
        creatorInfo:
          item.creator_id && item.creator_name
            ? {
                creatorId: item.creator_id,
                creatorName: item.creator_name,
              }
            : undefined,
        liveStreamInfo: item.live_id
          ? {
              liveId: item.live_id,
              livePrice: item.live_price,
            }
          : undefined,
      },
    };
  }

  private mapSearchItemToProductData(item: TikTokShopSearchItem): ProductData {
    return {
      platform: "tiktok_shop",
      platformId: item.product_id,
      title: item.title,
      mainImage: item.main_image,
      sourceUrl: `https://shop.tiktok.com/product/${item.product_id}`,
      price: item.price,
      currency: "USD",
      sales: item.sales ?? 0,
      salesPeriod: "month",
      status: "active",
      priority: "P1",
      isTrending: (item.sales ?? 0) > 1000,
      extraData: {
        shopRegion: item.shop_region ?? this.client.getRegion(),
      },
    };
  }

  private mapStatus(status: string): "active" | "inactive" | "deleted" | "sold_out" {
    switch (status.toLowerCase()) {
      case "active":
        return "active";
      case "inactive":
        return "inactive";
      case "deleted":
        return "deleted";
      case "sold_out":
        return "sold_out";
      default:
        return "active";
    }
  }
}
