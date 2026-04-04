import type { ProductData } from "../../../domain/types.js";
import { classifyError } from "../../classification/ErrorClassifier.js";
import type { AmazonSPApiClient } from "./AmazonSPApiClient.js";

export class AmazonProductApi {
  constructor(
    private client: AmazonSPApiClient,
    private marketplaceId: string,
  ) {}

  async getProduct(asin: string): Promise<ProductData> {
    try {
      const pricing = await this.getPricing(asin);
      const catalog = await this.getCatalogItem(asin);

      return this.transformToProductData(pricing, catalog);
    } catch (error) {
      const classified = classifyError(error, "amazon");
      throw new Error(`Failed to fetch Amazon product ${asin}: ${classified.message}`);
    }
  }

  async getProducts(asins: string[]): Promise<ProductData[]> {
    return Promise.all(asins.map((asin) => this.getProduct(asin)));
  }

  private async getPricing(asin: string): Promise<any> {
    const response = await this.client.callAPI({
      operation: "getPricing",
      endpoint: "productPricing",
      query: {
        Marketplaces: [this.marketplaceId],
        Asins: [asin],
        ItemType: "Asin",
      },
    });

    return response?.payload?.[0] ?? null;
  }

  private async getCatalogItem(asin: string): Promise<any> {
    const response = await this.client.callAPI({
      operation: "getCatalogItem",
      endpoint: "catalogItems",
      path: {
        asin,
      },
      query: {
        MarketplaceIds: [this.marketplaceId],
      },
    });

    return response;
  }

  private transformToProductData(pricing: any, catalog: any): ProductData {
    const price = this.extractPrice(pricing);
    const catalogData = this.extractCatalogData(catalog);

    return {
      platform: "amazon",
      platformId: catalog?.identifiers?.[0]?.identifiers?.ASIN ?? "",
      title: catalogData.title,
      mainImage: catalogData.mainImage,
      images: catalogData.images,
      sourceUrl: `https://www.amazon.com/dp/${catalog?.identifiers?.[0]?.identifiers?.ASIN ?? ""}`,
      price: price.current,
      originalPrice: price.original,
      currency: "USD",
      sales: 0,
      salesPeriod: "month",
      rating: catalogData.rating,
      reviewsCount: catalogData.reviewsCount,
      categoryId: catalogData.categoryId,
      categoryName: catalogData.categoryName,
      categoryPath: catalogData.categoryPath,
      status: "active",
      priority: "P1",
      isTrending: false,
      shopName: catalogData.brand,
      extraData: {
        amazonPricing: pricing,
        amazonCatalog: catalog,
      },
    };
  }

  private extractPrice(pricing: any): { current: number; original?: number } {
    if (!pricing) {
      return { current: 0 };
    }

    const offers = pricing?.offers ?? [];
    const firstOffer = offers[0];

    if (!firstOffer) {
      return { current: 0 };
    }

    const current = firstOffer?.Price?.LandedPrice?.Amount ?? 0;
    const original = firstOffer?.Price?.ListingPrice?.Amount ?? undefined;

    return { current, original };
  }

  private extractCatalogData(catalog: any): {
    title: string;
    mainImage?: string;
    images?: string[];
    rating?: number;
    reviewsCount?: number;
    categoryId?: string;
    categoryName?: string;
    categoryPath?: string[];
    brand?: string;
  } {
    if (!catalog) {
      return { title: "" };
    }

    const attributes = catalog?.attributes ?? [];
    const images = catalog?.images ?? [];

    const getTitle = () => {
      const titleAttr = attributes.find((attr: any) => attr?.name === "item_name");
      return titleAttr?.value ?? "";
    };

    const getBrand = () => {
      const brandAttr = attributes.find((attr: any) => attr?.name === "brand");
      return brandAttr?.value ?? undefined;
    };

    const getImages = () => {
      return images.map((img: any) => img?.url ?? "").filter(Boolean);
    };

    return {
      title: getTitle(),
      mainImage: getImages()[0],
      images: getImages(),
      brand: getBrand(),
      rating: undefined,
      reviewsCount: undefined,
      categoryId: catalog?.summaries?.[0]?.marketplaceId,
      categoryName: undefined,
      categoryPath: undefined,
    };
  }
}
