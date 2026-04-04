import type { ProductData } from "../../../domain/types.js";
import { Alibaba1688ApiClient } from "../alibaba/Alibaba1688ApiClient.js";

export interface TaoGongChangProductDetail {
  productId: string;
  subject: string;
  price: string;
  imageUrl: string;
  detailUrl: string;
  tags?: string[];
  moq?: number;
  leadTime?: number;
  factoryDirect?: boolean;
}

export class TaoGongChangClient {
  constructor(private alibaba1688Client: Alibaba1688ApiClient) {}

  static fromEnv(): TaoGongChangClient {
    return new TaoGongChangClient(Alibaba1688ApiClient.fromEnv());
  }

  async execute<T>(request: {
    method: string;
    params?: Record<string, string | number>;
  }): Promise<T> {
    return this.alibaba1688Client.execute({ method: request.method, params: request.params ?? {} });
  }

  async healthCheck(): Promise<{ healthy: boolean; latency?: number; error?: string }> {
    const start = Date.now();
    try {
      await this.execute({
        method: "alibaba.product.search",
        params: { page_no: 1, page_size: 1 },
      });
      return { healthy: true, latency: Date.now() - start };
    } catch (error) {
      return { healthy: false, error: error instanceof Error ? error.message : "Unknown error" };
    }
  }
}

export class TaoGongChangProductApi {
  constructor(private client: TaoGongChangClient) {}

  async getProductDetail(productId: string): Promise<ProductData | null> {
    try {
      const result = await this.client.execute<{ product: TaoGongChangProductDetail }>({
        method: "alibaba.product.get",
        params: { product_id: productId },
      });

      if (!result?.product) return null;
      const tags = result.product.tags ?? [];
      const isTaoGongChang = tags.includes("淘工厂") || tags.includes("淘工厂直供");

      if (!isTaoGongChang) return null;

      return {
        platform: "taogongchang",
        platformId: result.product.productId,
        title: result.product.subject,
        mainImage: result.product.imageUrl,
        sourceUrl: result.product.detailUrl,
        price: parseFloat(result.product.price) || 0,
        currency: "CNY",
        sales: 0,
        salesPeriod: "month",
        status: "active",
        priority: "P1",
        isTrending: false,
        extraData: {
          isTaoGongChang: true,
          factoryDirect: result.product.factoryDirect ?? true,
          moq: result.product.moq,
          leadTime: result.product.leadTime,
        },
      };
    } catch (error) {
      console.error(`Failed to fetch TaoGongChang product ${productId}:`, error);
      throw error;
    }
  }

  async searchProducts(
    keyword: string,
    page = 1,
    pageSize = 20,
  ): Promise<{ products: ProductData[]; total: number; page: number }> {
    try {
      const result = await this.client.execute<{
        products: TaoGongChangProductDetail[];
        total: number;
      }>({
        method: "alibaba.product.search",
        params: { keyword, page_no: page, page_size: pageSize, tags: "淘工厂" },
      });

      const items = result?.products ?? [];
      const total = result?.total ?? 0;

      return {
        products: items.map((item) => ({
          platform: "taogongchang" as const,
          platformId: item.productId,
          title: item.subject,
          mainImage: item.imageUrl,
          sourceUrl: item.detailUrl,
          price: parseFloat(item.price) || 0,
          currency: "CNY",
          sales: 0,
          salesPeriod: "month" as const,
          status: "active" as const,
          priority: "P1" as const,
          isTrending: false,
          extraData: {
            isTaoGongChang: true,
            factoryDirect: item.factoryDirect ?? true,
            moq: item.moq,
            leadTime: item.leadTime,
          },
        })),
        total,
        page,
      };
    } catch (error) {
      console.error(`Failed to search TaoGongChang products:`, error);
      throw error;
    }
  }
}
