import { faker } from "@faker-js/faker";
import type {
  ProductData,
  Platform,
  ProductStatus,
  ProductPriority,
  SalesPeriod,
} from "../../src/domain/types.js";

const PLATFORM_DEFAULTS: Record<Platform, Partial<ProductData>> = {
  taobao: { currency: "CNY", salesPeriod: "month" },
  amazon: { currency: "USD", salesPeriod: "day" },
  douyin: { currency: "CNY", salesPeriod: "week" },
  "1688": { currency: "CNY", salesPeriod: "month" },
  shopee: { currency: "SGD", salesPeriod: "month" },
  pinduoduo: { currency: "CNY", salesPeriod: "month" },
  jd: { currency: "CNY", salesPeriod: "month" },
  aliexpress: { currency: "USD", salesPeriod: "month" },
};

export function createProduct(overrides: Partial<ProductData> = {}): ProductData {
  const platform =
    overrides.platform ?? faker.helpers.arrayElement(["taobao", "amazon"] as Platform[]);
  const platformId = overrides.platformId ?? faker.string.numeric(10);
  const defaults = PLATFORM_DEFAULTS[platform] ?? {};

  return {
    platform,
    platformId,
    title: faker.commerce.productName(),
    mainImage: faker.image.url(),
    images: [faker.image.url(), faker.image.url()],
    sourceUrl: `https://example.com/product/${platformId}`,
    price: parseFloat(faker.commerce.price({ min: 1, max: 10000 })),
    originalPrice: parseFloat(faker.commerce.price({ min: 1, max: 15000 })),
    currency: defaults.currency ?? "CNY",
    sales: faker.number.int({ min: 0, max: 100000 }),
    salesUnit: "件",
    salesPeriod: defaults.salesPeriod ?? ("month" as SalesPeriod),
    rating: parseFloat(faker.finance.amount({ min: 0, max: 5, dec: 1 })),
    reviewsCount: faker.number.int({ min: 0, max: 50000 }),
    shopId: faker.string.alphanumeric(8),
    shopName: faker.company.name(),
    shopUrl: faker.internet.url(),
    categoryId: faker.string.numeric(6),
    categoryName: faker.commerce.department(),
    categoryPath: [faker.commerce.department(), faker.commerce.productMaterial()],
    status: faker.helpers.arrayElement(["active", "inactive", "sold_out"] as ProductStatus[]),
    priority: faker.helpers.arrayElement(["P0", "P1", "P2"] as ProductPriority[]),
    isTrending: faker.datatype.boolean(),
    tags: [faker.commerce.productAdjective(), faker.commerce.productMaterial()],
    ...defaults,
    ...overrides,
  };
}

export function createProductList(
  count: number,
  overrides: Partial<ProductData> = {},
): ProductData[] {
  return Array.from({ length: count }, () => createProduct(overrides));
}

export function forPlatform(platform: Platform, overrides: Partial<ProductData> = {}): ProductData {
  return createProduct({ platform, ...overrides });
}

export const ProductFactory = {
  create: createProduct,
  createList: createProductList,
  forPlatform,
};
