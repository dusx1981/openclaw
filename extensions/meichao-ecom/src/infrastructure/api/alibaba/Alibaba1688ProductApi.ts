import type { ProductData } from "../../../domain/types.js";
import type { Alibaba1688ApiClient } from "./Alibaba1688ApiClient.js";

export interface Alibaba1688ProductDetail {
  productId: string;
  subject: string;
  price: string;
  imageUrl: string;
  detailUrl: string;
  saleCount: number;
  sellerUserId: string;
  sellerCompany: string;
  categoryId: string;
  status: string;
  wholesalePrice?: string;
  minOrderQuantity?: number;
  supportOnlineTrade?: boolean;
}

export interface Alibaba1688SearchItem {
  productId: string;
  subject: string;
  price: string;
  imageUrl: string;
  saleCount: number;
}

export class Alibaba1688ProductApi {
  constructor(private client: Alibaba1688ApiClient) {}

  async getProductDetail(productId: string): Promise<ProductData | null> {
    try {
      const result = await this.client.execute<{ product: Alibaba1688ProductDetail }>({
        method: "alibaba.product.get",
        params: {
          product_id: productId,
        },
      });

      if (!result?.product) {
        return null;
      }

      return this.mapToProductData(result.product);
    } catch (error) {
      console.error(`Failed to fetch 1688 product ${productId}:`, error);
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
        products: {
          product: Alibaba1688SearchItem[];
          totalCount: number;
        };
      }>({
        method: "alibaba.product.search",
        params: {
          keywords: keyword,
          page_no: page,
          page_size: pageSize,
        },
      });

      const items = result?.products?.product ?? [];
      const total = result?.products?.totalCount ?? 0;

      return {
        products: items.map((item) => this.mapSearchItemToProductData(item)),
        total,
        page,
      };
    } catch (error) {
      console.error(`Failed to search 1688 products with keyword "${keyword}":`, error);
      throw error;
    }
  }

  private mapToProductData(item: Alibaba1688ProductDetail): ProductData {
    return {
      platform: "1688",
      platformId: item.productId,
      title: item.subject,
      mainImage: item.imageUrl,
      sourceUrl: item.detailUrl || `https://detail.1688.com/offer/${item.productId}.html`,
      price: parseFloat(item.price) || 0,
      currency: "CNY",
      sales: item.saleCount || 0,
      salesPeriod: "month",
      status: this.mapStatus(item.status),
      priority: "P1",
      isTrending: (item.saleCount || 0) > 500,
      shopName: item.sellerCompany,
      extraData: {
        wholesalePrice: item.wholesalePrice ? parseFloat(item.wholesalePrice) : undefined,
        minOrderQuantity: item.minOrderQuantity,
        supportOnlineTrade: item.supportOnlineTrade,
        sellerUserId: item.sellerUserId,
      },
    };
  }

  private mapSearchItemToProductData(item: Alibaba1688SearchItem): ProductData {
    return {
      platform: "1688",
      platformId: item.productId,
      title: item.subject,
      mainImage: item.imageUrl,
      sourceUrl: `https://detail.1688.com/offer/${item.productId}.html`,
      price: parseFloat(item.price) || 0,
      currency: "CNY",
      sales: item.saleCount || 0,
      salesPeriod: "month",
      status: "active",
      priority: "P1",
      isTrending: (item.saleCount || 0) > 500,
    };
  }

  private mapStatus(status: string): "active" | "inactive" | "deleted" | "sold_out" {
    switch (status) {
      case "published":
        return "active";
      case "expired":
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
