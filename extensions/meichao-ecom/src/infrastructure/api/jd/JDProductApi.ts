import type { ProductData } from "../../../domain/types.js";
import type { JDClient } from "./JDClient.js";

export interface JDProductDetail {
  skuId: string;
  skuName: string;
  price: string;
  imageUrl: string;
  detailUrl: string;
  sales: number;
  shopName: string;
  categoryId: string;
  status: number;
  commissionInfo?: {
    commission: number;
    commissionRate: number;
  };
  plusPrice?: string;
  couponInfo?: {
    coupon: number;
    link: string;
  };
}

export interface JDSearchItem {
  skuId: string;
  skuName: string;
  price: string;
  imageUrl: string;
  sales: number;
  commissionInfo?: {
    commission: number;
  };
}

export class JDProductApi {
  constructor(private client: JDClient) {}

  async getProductDetail(skuId: string): Promise<ProductData | null> {
    try {
      const result = await this.client.execute<{ sku: JDProductDetail }>({
        method: "jd.union.open.goods.promotiongoodsinfo",
        params: {
          skuIds: skuId,
        },
        needAuth: true,
      });

      if (!result?.sku) {
        return null;
      }

      return this.mapToProductData(result.sku);
    } catch (error) {
      console.error(`Failed to fetch JD product ${skuId}:`, error);
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
        data: {
          productList: JDSearchItem[];
          totalCount: number;
        };
      }>({
        method: "jd.union.open.goods.query",
        params: {
          keyword,
          pageIndex: page,
          pageSize,
        },
        needAuth: true,
      });

      const items = result?.data?.productList ?? [];
      const total = result?.data?.totalCount ?? 0;

      return {
        products: items.map((item) => this.mapSearchItemToProductData(item)),
        total,
        page,
      };
    } catch (error) {
      console.error(`Failed to search JD products with keyword "${keyword}":`, error);
      throw error;
    }
  }

  async getJingFenProducts(
    eliteId: number,
    page = 1,
    pageSize = 20,
  ): Promise<{
    products: ProductData[];
    total: number;
    page: number;
  }> {
    try {
      const result = await this.client.execute<{
        data: {
          productList: JDSearchItem[];
          totalCount: number;
        };
      }>({
        method: "jd.union.open.goods.jingfen.query",
        params: {
          eliteId,
          pageIndex: page,
          pageSize,
        },
        needAuth: true,
      });

      const items = result?.data?.productList ?? [];
      const total = result?.data?.totalCount ?? 0;

      return {
        products: items.map((item) => this.mapSearchItemToProductData(item)),
        total,
        page,
      };
    } catch (error) {
      console.error(`Failed to get JD jingfen products:`, error);
      throw error;
    }
  }

  private mapToProductData(item: JDProductDetail): ProductData {
    return {
      platform: "jd",
      platformId: item.skuId,
      title: item.skuName,
      mainImage: item.imageUrl,
      sourceUrl: item.detailUrl || `https://item.jd.com/${item.skuId}.html`,
      price: parseFloat(item.price) || 0,
      currency: "CNY",
      sales: item.sales || 0,
      salesPeriod: "month",
      status: this.mapStatus(item.status),
      priority: "P1",
      isTrending: (item.sales || 0) > 1000,
      shopName: item.shopName,
      extraData: {
        commissionInfo: item.commissionInfo,
        plusPrice: item.plusPrice ? parseFloat(item.plusPrice) : undefined,
        couponInfo: item.couponInfo,
      },
    };
  }

  private mapSearchItemToProductData(item: JDSearchItem): ProductData {
    return {
      platform: "jd",
      platformId: item.skuId,
      title: item.skuName,
      mainImage: item.imageUrl,
      sourceUrl: `https://item.jd.com/${item.skuId}.html`,
      price: parseFloat(item.price) || 0,
      currency: "CNY",
      sales: item.sales || 0,
      salesPeriod: "month",
      status: "active",
      priority: "P1",
      isTrending: (item.sales || 0) > 1000,
      extraData: {
        commissionInfo: item.commissionInfo,
      },
    };
  }

  private mapStatus(status: number): "active" | "inactive" | "deleted" | "sold_out" {
    switch (status) {
      case 1:
        return "active";
      case 0:
        return "inactive";
      case -1:
        return "deleted";
      case 2:
        return "sold_out";
      default:
        return "active";
    }
  }
}
