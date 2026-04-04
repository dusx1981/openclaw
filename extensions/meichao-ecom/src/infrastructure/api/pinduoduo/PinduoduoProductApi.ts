import type { ProductData } from "../../../domain/types.js";
import type { PinduoduoClient } from "./PinduoduoClient.js";

export interface PinduoduoGoodsDetail {
  goods_id: number;
  goods_name: string;
  min_group_price: number;
  min_normal_price: number;
  goods_image_url: string;
  goods_thumbnail_url: string;
  sales_tip: string;
  category_id: number;
  category_name: string;
  merchant_type: number;
  mall_id: number;
  mall_name: string;
  group_required_num?: number;
  has_coupon?: boolean;
  coupon_discount?: number;
}

export interface PinduoduoSearchItem {
  goods_id: number;
  goods_name: string;
  min_group_price: number;
  goods_image_url: string;
  sales_tip: string;
}

export class PinduoduoProductApi {
  constructor(private client: PinduoduoClient) {}

  async getGoodsDetail(goodsId: string): Promise<ProductData | null> {
    try {
      const result = await this.client.execute<{ goods_detail: PinduoduoGoodsDetail }>({
        type: "pdd.ddk.goods.detail",
        params: {
          goods_id: goodsId,
        },
      });

      if (!result?.goods_detail) {
        return null;
      }

      return this.mapToProductData(result.goods_detail);
    } catch (error) {
      console.error(`Failed to fetch Pinduoduo product ${goodsId}:`, error);
      throw error;
    }
  }

  async searchGoods(
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
        goods_list: PinduoduoSearchItem[];
        total_count: number;
      }>({
        type: "pdd.ddk.goods.search",
        params: {
          keyword,
          page,
          page_size: pageSize,
        },
      });

      const items = result?.goods_list ?? [];
      const total = result?.total_count ?? 0;

      return {
        products: items.map((item) => this.mapSearchItemToProductData(item)),
        total,
        page,
      };
    } catch (error) {
      console.error(`Failed to search Pinduoduo goods with keyword "${keyword}":`, error);
      throw error;
    }
  }

  async getRecommendGoods(
    page = 1,
    pageSize = 20,
  ): Promise<{
    products: ProductData[];
    total: number;
    page: number;
  }> {
    try {
      const result = await this.client.execute<{
        list: PinduoduoSearchItem[];
        total: number;
      }>({
        type: "pdd.ddk.goods.recommend.get",
        params: {
          page,
          page_size: pageSize,
        },
      });

      const items = result?.list ?? [];
      const total = result?.total ?? 0;

      return {
        products: items.map((item) => this.mapSearchItemToProductData(item)),
        total,
        page,
      };
    } catch (error) {
      console.error("Failed to get Pinduoduo recommend goods:", error);
      throw error;
    }
  }

  private mapToProductData(item: PinduoduoGoodsDetail): ProductData {
    return {
      platform: "pinduoduo",
      platformId: String(item.goods_id),
      title: item.goods_name,
      mainImage: item.goods_image_url || item.goods_thumbnail_url,
      sourceUrl: `https://mobile.yangkeduo.com/goods.html?goods_id=${item.goods_id}`,
      price: item.min_group_price / 100,
      originalPrice: item.min_normal_price / 100,
      currency: "CNY",
      sales: this.parseSalesTip(item.sales_tip),
      salesPeriod: "month",
      status: "active",
      priority: "P1",
      isTrending: this.parseSalesTip(item.sales_tip) > 500,
      shopName: item.mall_name,
      categoryId: String(item.category_id),
      categoryName: item.category_name,
      extraData: {
        groupPrice: item.min_group_price / 100,
        normalPrice: item.min_normal_price / 100,
        groupRequiredNum: item.group_required_num,
        hasCoupon: item.has_coupon,
        couponDiscount: item.coupon_discount,
        salesTip: item.sales_tip,
      },
    };
  }

  private mapSearchItemToProductData(item: PinduoduoSearchItem): ProductData {
    return {
      platform: "pinduoduo",
      platformId: String(item.goods_id),
      title: item.goods_name,
      mainImage: item.goods_image_url,
      sourceUrl: `https://mobile.yangkeduo.com/goods.html?goods_id=${item.goods_id}`,
      price: item.min_group_price / 100,
      currency: "CNY",
      sales: this.parseSalesTip(item.sales_tip),
      salesPeriod: "month",
      status: "active",
      priority: "P1",
      isTrending: this.parseSalesTip(item.sales_tip) > 500,
    };
  }

  private parseSalesTip(salesTip: string): number {
    if (!salesTip) return 0;

    const match = salesTip.match(/(\d+)/);
    if (!match) return 0;

    const num = parseInt(match[1], 10);

    if (salesTip.includes("万")) {
      return num * 10000;
    }
    if (salesTip.includes("千")) {
      return num * 1000;
    }
    if (salesTip.includes("百")) {
      return num * 100;
    }

    return num;
  }
}
