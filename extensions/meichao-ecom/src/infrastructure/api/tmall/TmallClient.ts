import type { ProductData } from "../../../domain/types.js";
import { TaobaoApiClient } from "../taobao/TaobaoApiClient.js";

export interface TmallProductDetail {
  num_iid: string;
  title: string;
  price: string;
  pic_url: string;
  detail_url: string;
  nick: string;
  user_type: number;
  volume: number;
  cid: number;
}

export class TmallClient {
  constructor(private taobaoClient: TaobaoApiClient) {}

  static fromEnv(): TmallClient {
    return new TmallClient(TaobaoApiClient.fromEnv());
  }

  async execute<T>(request: {
    method: string;
    params?: Record<string, string | number>;
  }): Promise<T> {
    return this.taobaoClient.execute({ method: request.method, params: request.params ?? {} });
  }

  async healthCheck(): Promise<{ healthy: boolean; latency?: number; error?: string }> {
    const start = Date.now();
    try {
      await this.execute({ method: "taobao.items.search", params: { page_no: 1, page_size: 1 } });
      return { healthy: true, latency: Date.now() - start };
    } catch (error) {
      return { healthy: false, error: error instanceof Error ? error.message : "Unknown error" };
    }
  }
}

export class TmallProductApi {
  constructor(private client: TmallClient) {}

  async getProductDetail(numIid: string): Promise<ProductData | null> {
    try {
      const result = await this.client.execute<{ item: TmallProductDetail }>({
        method: "taobao.item.get",
        params: {
          num_iid: numIid,
          fields: "num_iid,title,price,pic_url,detail_url,nick,user_type,volume,cid",
        },
      });

      if (!result?.item || result.item.user_type !== 1) return null;

      return {
        platform: "tmall",
        platformId: result.item.num_iid,
        title: result.item.title,
        mainImage: result.item.pic_url,
        sourceUrl: result.item.detail_url,
        price: parseFloat(result.item.price) || 0,
        currency: "CNY",
        sales: result.item.volume || 0,
        salesPeriod: "month",
        status: "active",
        priority: "P1",
        isTrending: result.item.volume > 1000,
        categoryId: String(result.item.cid),
        extraData: {
          isTmall: true,
          brandAuth: undefined,
          flagshipStore: undefined,
          tmallLevel: undefined,
        },
      };
    } catch (error) {
      console.error(`Failed to fetch Tmall product ${numIid}:`, error);
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
        items: { item: TmallProductDetail[]; total_results: number };
      }>({
        method: "taobao.items.search",
        params: { q: keyword, page_no: page, page_size: pageSize },
      });

      const items = (result?.items?.item ?? []).filter((item) => item.user_type === 1);
      const total = result?.items?.total_results ?? 0;

      return {
        products: items.map((item) => ({
          platform: "tmall" as const,
          platformId: item.num_iid,
          title: item.title,
          mainImage: item.pic_url,
          sourceUrl: item.detail_url,
          price: parseFloat(item.price) || 0,
          currency: "CNY",
          sales: item.volume || 0,
          salesPeriod: "month" as const,
          status: "active" as const,
          priority: "P1" as const,
          isTrending: item.volume > 1000,
          extraData: { isTmall: true },
        })),
        total,
        page,
      };
    } catch (error) {
      console.error(`Failed to search Tmall products:`, error);
      throw error;
    }
  }
}
