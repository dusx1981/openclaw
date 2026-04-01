import type { ProductData } from "../../../domain/types.js";
import type { TaobaoApiClient } from "./TaobaoApiClient.js";
import {
  TaobaoRequestBuilder,
  type ProductDetailParams,
  type ProductSearchParams,
} from "./TaobaoRequestBuilder.js";

export interface TaobaoProductDetail {
  num_iid: string;
  title: string;
  price: string;
  pic_url: string;
  detail_url: string;
  volume: number;
  nick: string;
  cid: number;
  approve_status: string;
}

export interface TaobaoSearchItem {
  num_iid: string;
  title: string;
  price: string;
  pic_url: string;
  volume: number;
}

export class TaobaoProductApi {
  constructor(private client: TaobaoApiClient) {}

  async getProductDetail(numIid: string): Promise<ProductData | null> {
    const request = TaobaoRequestBuilder.buildProductDetailRequest({
      num_iid: numIid,
    });

    try {
      const result = await this.client.execute<{ item: TaobaoProductDetail }>(request);

      if (!result?.item) {
        return null;
      }

      return this.mapToProductData(result.item);
    } catch (error) {
      console.error(`Failed to fetch product ${numIid}:`, error);
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
    const request = TaobaoRequestBuilder.buildProductSearchRequest({
      q: keyword,
      page_no: page,
      page_size: pageSize,
    });

    try {
      const result = await this.client.execute<{
        items: {
          item: TaobaoSearchItem[];
          total_results: number;
        };
      }>(request);

      const items = result?.items?.item ?? [];
      const total = result?.items?.total_results ?? 0;

      return {
        products: items.map((item) => this.mapSearchItemToProductData(item)),
        total,
        page,
      };
    } catch (error) {
      console.error(`Failed to search products with keyword "${keyword}":`, error);
      throw error;
    }
  }

  private mapToProductData(item: TaobaoProductDetail): ProductData {
    return {
      platform: "taobao",
      platformId: item.num_iid,
      title: item.title,
      mainImage: item.pic_url,
      sourceUrl: item.detail_url || `https://item.taobao.com/item.htm?id=${item.num_iid}`,
      price: parseFloat(item.price) || 0,
      currency: "CNY",
      sales: item.volume || 0,
      salesPeriod: "month",
      status: this.mapStatus(item.approve_status),
      priority: "P1",
      isTrending: (item.volume || 0) > 1000,
      shopName: item.nick,
    };
  }

  private mapSearchItemToProductData(item: TaobaoSearchItem): ProductData {
    return {
      platform: "taobao",
      platformId: item.num_iid,
      title: item.title,
      mainImage: item.pic_url,
      sourceUrl: `https://item.taobao.com/item.htm?id=${item.num_iid}`,
      price: parseFloat(item.price) || 0,
      currency: "CNY",
      sales: item.volume || 0,
      salesPeriod: "month",
      status: "active",
      priority: "P1",
      isTrending: (item.volume || 0) > 1000,
    };
  }

  private mapStatus(status: string): "active" | "inactive" | "deleted" | "sold_out" {
    switch (status) {
      case "onsale":
        return "active";
      case "instock":
        return "inactive";
      case "deleted":
        return "deleted";
      default:
        return "active";
    }
  }
}
