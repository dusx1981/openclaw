import type { ProductData } from "../../../domain/types.js";
import type { ShopeeClient } from "./ShopeeClient.js";

export interface ShopeeProductDetail {
  item_id: number;
  item_name: string;
  price: number;
  original_price?: number;
  image_url: string;
  images?: string[];
  item_status: string;
  stock_info?: {
    total_stock: number;
  };
  category_id: number;
  shop_info?: {
    shop_id: number;
    shop_name: string;
    shop_location: string;
    is_shopee_verified: boolean;
    is_official_shop: boolean;
  };
  currency: string;
  discount_rate?: number;
  creation_time?: number;
  update_time?: number;
}

export interface ShopeeSearchItem {
  item_id: number;
  item_name: string;
  price: number;
  image_url: string;
  currency: string;
  shop_location?: string;
}

export interface ShopeeProductList {
  item_list: ShopeeSearchItem[];
  total_count: number;
  has_more: boolean;
}

export class ShopeeProductApi {
  constructor(private client: ShopeeClient) {}

  async getProductDetail(itemId: string): Promise<ProductData | null> {
    try {
      const result = await this.client.execute<{ item: ShopeeProductDetail }>({
        path: "/item/get_item_base_info",
        params: {
          item_id: itemId,
        },
      });

      if (!result?.item) {
        return null;
      }

      return this.mapToProductData(result.item);
    } catch (error) {
      console.error(`Failed to fetch Shopee product ${itemId}:`, error);
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
      const result = await this.client.execute<ShopeeProductList>({
        path: "/item/search",
        params: {
          search_text: keyword,
          page_number: page,
          page_size: pageSize,
        },
      });

      const items = result?.item_list ?? [];
      const total = result?.total_count ?? 0;

      return {
        products: items.map((item) => this.mapSearchItemToProductData(item)),
        total,
        page,
      };
    } catch (error) {
      console.error(`Failed to search Shopee products with keyword "${keyword}":`, error);
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
      const result = await this.client.execute<ShopeeProductList>({
        path: "/item/get_item_list",
        params: {
          page_number: page,
          page_size: pageSize,
        },
      });

      const items = result?.item_list ?? [];
      const total = result?.total_count ?? 0;

      return {
        products: items.map((item) => this.mapSearchItemToProductData(item)),
        total,
        page,
      };
    } catch (error) {
      console.error("Failed to get Shopee product list:", error);
      throw error;
    }
  }

  private mapToProductData(item: ShopeeProductDetail): ProductData {
    return {
      platform: "shopee",
      platformId: String(item.item_id),
      title: item.item_name,
      mainImage: item.image_url,
      sourceUrl: `https://shopee.${this.client.getRegion().toLowerCase()}/product/${item.shop_info?.shop_id ?? 0}/${item.item_id}`,
      price: item.price,
      originalPrice: item.original_price,
      currency: item.currency,
      sales: item.stock_info?.total_stock ?? 0,
      salesPeriod: "month",
      status: this.mapStatus(item.item_status),
      priority: "P1",
      isTrending: item.discount_rate !== undefined && item.discount_rate > 0.2,
      categoryId: String(item.category_id),
      shopName: item.shop_info?.shop_name,
      extraData: {
        shopLocation: item.shop_info?.shop_location,
        shopeeVerified: item.shop_info?.is_shopee_verified,
        crossBorder: item.shop_info?.shop_location !== this.client.getRegion(),
        currency: item.currency,
        discountRate: item.discount_rate,
        isOfficialShop: item.shop_info?.is_official_shop,
      },
    };
  }

  private mapSearchItemToProductData(item: ShopeeSearchItem): ProductData {
    return {
      platform: "shopee",
      platformId: String(item.item_id),
      title: item.item_name,
      mainImage: item.image_url,
      sourceUrl: `https://shopee.${this.client.getRegion().toLowerCase()}/search?keyword=${encodeURIComponent(item.item_name)}`,
      price: item.price,
      currency: item.currency,
      sales: 0,
      salesPeriod: "month",
      status: "active",
      priority: "P1",
      isTrending: false,
      extraData: {
        shopLocation: item.shop_location,
        currency: item.currency,
      },
    };
  }

  private mapStatus(status: string): "active" | "inactive" | "deleted" | "sold_out" {
    switch (status) {
      case "NORMAL":
        return "active";
      case "BANNED":
        return "inactive";
      case "DELETED":
        return "deleted";
      case "UNLISTED":
        return "sold_out";
      default:
        return "active";
    }
  }
}
