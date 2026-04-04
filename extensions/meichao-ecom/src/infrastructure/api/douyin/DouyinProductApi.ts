import type { ProductData } from "../../../domain/types.js";
import type { DouyinClient } from "./DouyinClient.js";

export interface DouyinProductDetail {
  product_id: string;
  title: string;
  price: number;
  original_price?: number;
  live_price?: number;
  main_image: string;
  images?: string[];
  detail_url: string;
  sales: number;
  category_id: string;
  category_name?: string;
  commission_rate?: number;
  video_url?: string;
  influencer_id?: string;
  influencer_name?: string;
  status: number;
}

export interface DouyinSearchItem {
  product_id: string;
  title: string;
  price: number;
  main_image: string;
  sales: number;
  commission_rate?: number;
}

export interface DouyinProductList {
  products: DouyinSearchItem[];
  total: number;
  page: number;
}

export class DouyinProductApi {
  constructor(private client: DouyinClient) {}

  async getProductDetail(productId: string): Promise<ProductData | null> {
    try {
      const result = await this.client.execute<{ product: DouyinProductDetail }>({
        method: "product.detail",
        params: {
          product_id: productId,
        },
      });

      if (!result?.product) {
        return null;
      }

      return this.mapToProductData(result.product);
    } catch (error) {
      console.error(`Failed to fetch Douyin product ${productId}:`, error);
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
      const result = await this.client.execute<DouyinProductList>({
        method: "product.search",
        params: {
          keyword,
          page,
          size: pageSize,
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
      console.error(`Failed to search Douyin products with keyword "${keyword}":`, error);
      throw error;
    }
  }

  async getProductList(
    page = 1,
    pageSize = 20,
  ): Promise<{
    products: ProductData[];
    total: number;
    page: number;
  }> {
    try {
      const result = await this.client.execute<DouyinProductList>({
        method: "product.list",
        params: {
          page,
          size: pageSize,
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
      console.error("Failed to get Douyin product list:", error);
      throw error;
    }
  }

  private mapToProductData(item: DouyinProductDetail): ProductData {
    return {
      platform: "douyin",
      platformId: item.product_id,
      title: item.title,
      mainImage: item.main_image,
      sourceUrl: item.detail_url,
      price: item.price,
      originalPrice: item.original_price,
      currency: "CNY",
      sales: item.sales,
      salesPeriod: "month",
      status: this.mapStatus(item.status),
      priority: "P1",
      isTrending: item.sales > 1000,
      categoryId: item.category_id,
      categoryName: item.category_name,
      extraData: {
        livePrice: item.live_price,
        videoUrl: item.video_url,
        influencerInfo:
          item.influencer_id && item.influencer_name
            ? {
                id: item.influencer_id,
                name: item.influencer_name,
              }
            : undefined,
        commissionRate: item.commission_rate,
      },
    };
  }

  private mapSearchItemToProductData(item: DouyinSearchItem): ProductData {
    return {
      platform: "douyin",
      platformId: item.product_id,
      title: item.title,
      mainImage: item.main_image,
      sourceUrl: `https://haohuo.jinritemai.com/views/product?id=${item.product_id}`,
      price: item.price,
      currency: "CNY",
      sales: item.sales,
      salesPeriod: "month",
      status: "active",
      priority: "P1",
      isTrending: item.sales > 1000,
      extraData: {
        commissionRate: item.commission_rate,
      },
    };
  }

  private mapStatus(status: number): "active" | "inactive" | "deleted" | "sold_out" {
    switch (status) {
      case 1:
        return "active";
      case 0:
        return "inactive";
      case 2:
        return "sold_out";
      case 3:
        return "deleted";
      default:
        return "active";
    }
  }
}
