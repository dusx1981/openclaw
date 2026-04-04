import type { ProductData } from "../../../domain/types.js";
import type { LazadaClient } from "./LazadaClient.js";

export interface LazadaProductDetail {
  item_id: string;
  name: string;
  price: number;
  special_price?: number;
  images: string[];
  url: string;
  brand?: string;
  seller_id: string;
  seller_name?: string;
  country: string;
  status: string;
  rating_star?: number;
}

export interface LazadaSearchItem {
  item_id: string;
  name: string;
  price: number;
  images: string[];
}

export class LazadaProductApi {
  constructor(private client: LazadaClient) {}

  async getProductDetail(itemId: string): Promise<ProductData | null> {
    try {
      const result = await this.client.execute<{ product: LazadaProductDetail }>({
        action: "GetProductItem",
        params: { item_id: itemId },
      });

      if (!result?.product) {
        return null;
      }

      return this.mapToProductData(result.product);
    } catch (error) {
      console.error(`Failed to fetch Lazada product ${itemId}:`, error);
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
      const result = await this.client.execute<{
        products: LazadaSearchItem[];
        total: number;
      }>({
        action: "SearchProducts",
        params: {
          search_term: keyword,
          page,
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
      console.error(`Failed to search Lazada products with keyword "${keyword}":`, error);
      throw error;
    }
  }

  private mapToProductData(item: LazadaProductDetail): ProductData {
    return {
      platform: "lazada",
      platformId: item.item_id,
      title: item.name,
      mainImage: item.images?.[0] ?? "",
      sourceUrl: item.url,
      price: item.special_price ?? item.price,
      originalPrice: item.price,
      currency: "SGD",
      sales: 0,
      salesPeriod: "month",
      status: this.mapStatus(item.status),
      priority: "P1",
      isTrending: (item.rating_star ?? 0) >= 4.5,
      shopName: item.seller_name,
      extraData: {
        shopLocation: item.country ?? this.client.getCountry(),
        lazadaMall: false,
        countryCode: item.country ?? this.client.getCountry(),
        brand: item.brand,
        ratingScore: item.rating_star,
      },
    };
  }

  private mapSearchItemToProductData(item: LazadaSearchItem): ProductData {
    return {
      platform: "lazada",
      platformId: item.item_id,
      title: item.name,
      mainImage: item.images?.[0] ?? "",
      sourceUrl: `https://www.lazada.sg/products/i${item.item_id}`,
      price: item.price,
      currency: "SGD",
      sales: 0,
      salesPeriod: "month",
      status: "active",
      priority: "P1",
      isTrending: false,
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
