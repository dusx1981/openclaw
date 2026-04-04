import type { ProductData } from "../../../domain/types.js";
import type { TumeClient } from "./TumeClient.js";

export interface TumeProductDetail {
  product_id: string;
  title: string;
  price: number;
  original_price?: number;
  main_image: string;
  ship_to_countries?: string[];
  moq?: number;
  delivery_time?: number;
  status: string;
}

export class TumeProductApi {
  constructor(private client: TumeClient) {}

  async getProductDetail(productId: string): Promise<ProductData | null> {
    try {
      const result = await this.client.execute<{ product: TumeProductDetail }>({
        method: "product.detail",
        params: { product_id: productId },
      });
      if (!result?.product) return null;
      return this.mapToProductData(result.product);
    } catch (error) {
      console.error(`Failed to fetch TUME product ${productId}:`, error);
      throw error;
    }
  }

  async searchProducts(
    keyword: string,
    page = 1,
    pageSize = 20,
  ): Promise<{ products: ProductData[]; total: number; page: number }> {
    try {
      const result = await this.client.execute<{ products: TumeProductDetail[]; total: number }>({
        method: "product.search",
        params: { keyword, page, page_size: pageSize },
      });
      const items = result?.products ?? [];
      return {
        products: items.map((item) => this.mapToProductData(item)),
        total: result?.total ?? 0,
        page,
      };
    } catch (error) {
      console.error(`Failed to search TUME products:`, error);
      throw error;
    }
  }

  private mapToProductData(item: TumeProductDetail): ProductData {
    return {
      platform: "tume",
      platformId: item.product_id,
      title: item.title,
      mainImage: item.main_image,
      sourceUrl: `https://www.tume.com/product/${item.product_id}`,
      price: item.price,
      originalPrice: item.original_price,
      currency: "CNY",
      sales: 0,
      salesPeriod: "month",
      status: this.mapStatus(item.status),
      priority: "P1",
      isTrending: false,
      extraData: {
        shipToCountries: item.ship_to_countries,
        moq: item.moq,
        deliveryTime: item.delivery_time,
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
      default:
        return "active";
    }
  }
}
