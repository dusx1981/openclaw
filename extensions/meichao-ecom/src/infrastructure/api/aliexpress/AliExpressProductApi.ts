import type { ProductData } from "../../../domain/types.js";
import type { AliExpressClient } from "./AliExpressClient.js";

export interface AliExpressProductDetail {
  product_id: string;
  product_title: string;
  sale_price: number;
  original_price?: number;
  product_image_url: string;
  product_detail_url: string;
  commission_rate?: string;
  discount_rate?: number;
  ship_to_countries?: string[];
  delivery_time?: number;
  original_language?: string;
  product_status: string;
  category_id?: number;
  shop_name?: string;
  rating_star?: number;
}

export interface AliExpressSearchItem {
  product_id: string;
  product_title: string;
  sale_price: number;
  product_image_url: string;
  commission_rate?: string;
  ship_to_countries?: string[];
}

export interface AliExpressProductList {
  products: AliExpressSearchItem[];
  total_count: number;
  current_page_no: number;
}

export class AliExpressProductApi {
  constructor(private client: AliExpressClient) {}

  async getProductDetail(productId: string): Promise<ProductData | null> {
    try {
      const result = await this.client.execute<{ product: AliExpressProductDetail }>({
        method: "aliexpress.affiliate.product.detail",
        params: {
          product_id: productId,
        },
      });

      if (!result?.product) {
        return null;
      }

      return this.mapToProductData(result.product);
    } catch (error) {
      console.error(`Failed to fetch AliExpress product ${productId}:`, error);
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
      const result = await this.client.execute<AliExpressProductList>({
        method: "aliexpress.affiliate.product.query",
        params: {
          keywords: keyword,
          page_no: page,
          page_size: pageSize,
        },
      });

      const items = result?.products ?? [];
      const total = result?.total_count ?? 0;

      return {
        products: items.map((item) => this.mapSearchItemToProductData(item)),
        total,
        page,
      };
    } catch (error) {
      console.error(`Failed to search AliExpress products with keyword "${keyword}":`, error);
      throw error;
    }
  }

  async getFeaturedPromo(
    page = 1,
    pageSize = 20,
  ): Promise<{
    products: ProductData[];
    total: number;
    page: number;
  }> {
    try {
      const result = await this.client.execute<AliExpressProductList>({
        method: "aliexpress.affiliate.featured.promo.get",
        params: {
          page_no: page,
          page_size: pageSize,
        },
      });

      const items = result?.products ?? [];
      const total = result?.total_count ?? 0;

      return {
        products: items.map((item) => this.mapSearchItemToProductData(item)),
        total,
        page,
      };
    } catch (error) {
      console.error("Failed to get AliExpress featured promo:", error);
      throw error;
    }
  }

  private mapToProductData(item: AliExpressProductDetail): ProductData {
    return {
      platform: "aliexpress",
      platformId: item.product_id,
      title: item.product_title,
      mainImage: item.product_image_url,
      sourceUrl: item.product_detail_url,
      price: item.sale_price,
      originalPrice: item.original_price,
      currency: "USD",
      sales: 0,
      salesPeriod: "month",
      status: this.mapStatus(item.product_status),
      priority: "P1",
      isTrending: item.discount_rate !== undefined && item.discount_rate > 0.3,
      categoryId: item.category_id ? String(item.category_id) : undefined,
      shopName: item.shop_name,
      extraData: {
        shipToCountries: item.ship_to_countries,
        deliveryTime: item.delivery_time,
        originalLanguage: item.original_language ?? this.client.getLanguage(),
        discountRate: item.discount_rate,
        commissionRate: item.commission_rate,
        ratingStar: item.rating_star,
      },
    };
  }

  private mapSearchItemToProductData(item: AliExpressSearchItem): ProductData {
    return {
      platform: "aliexpress",
      platformId: item.product_id,
      title: item.product_title,
      mainImage: item.product_image_url,
      sourceUrl: `https://www.aliexpress.com/item/${item.product_id}.html`,
      price: item.sale_price,
      currency: "USD",
      sales: 0,
      salesPeriod: "month",
      status: "active",
      priority: "P1",
      isTrending: false,
      extraData: {
        shipToCountries: item.ship_to_countries,
        commissionRate: item.commission_rate,
      },
    };
  }

  private mapStatus(status: string): "active" | "inactive" | "deleted" | "sold_out" {
    switch (status.toLowerCase()) {
      case "onshelf":
        return "active";
      case "offshelf":
        return "inactive";
      case "deleted":
        return "deleted";
      case "soldout":
        return "sold_out";
      default:
        return "active";
    }
  }
}
