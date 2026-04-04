import { bench, describe, beforeAll } from "vitest";
import type { CacheProvider } from "../../../domain/ports/CacheProvider.js";
import type { ProductRepository } from "../../../domain/ports/ProductRepository.js";
import type { ProductData } from "../../../domain/types.js";
import { MockPlatformGateway } from "../../../infrastructure/adapters/MockPlatformGateway.js";
import { DataPipeline } from "../DataPipeline.js";
import { CacheFilter } from "../filters/CacheFilter.js";
import { DedupeFilter } from "../filters/DedupeFilter.js";
import { FetchFilter } from "../filters/FetchFilter.js";
import { StoreFilter } from "../filters/StoreFilter.js";
import { ValidateFilter } from "../filters/ValidateFilter.js";

function generateMockProducts(count: number): ProductData[] {
  return Array.from({ length: count }, (_, i) => ({
    platform: "taobao" as const,
    platformId: `product_${i}`,
    title: `Mock Product ${i}`,
    sourceUrl: `https://item.taobao.com/item.htm?id=${i}`,
    price: Math.random() * 1000,
    currency: "CNY",
    sales: Math.floor(Math.random() * 10000),
    salesPeriod: "month" as const,
    status: "active" as const,
    priority: "P1" as const,
    isTrending: false,
  }));
}

function generateMockProductsPartialInvalid(count: number, invalidRatio = 0.1): ProductData[] {
  return Array.from({ length: count }, (_, i) => {
    const isInvalid = Math.random() < invalidRatio;
    return {
      platform: "taobao" as const,
      platformId: isInvalid ? "" : `product_${i}`,
      title: isInvalid ? "" : `Mock Product ${i}`,
      sourceUrl: isInvalid ? "" : `https://item.taobao.com/item.htm?id=${i}`,
      price: isInvalid ? -1 : Math.random() * 1000,
      currency: "CNY",
      sales: Math.floor(Math.random() * 10000),
      salesPeriod: "month" as const,
      status: "active" as const,
      priority: "P1" as const,
      isTrending: false,
    };
  });
}

function generateMockProductsWithDuplicates(count: number, duplicateRatio = 0.3): ProductData[] {
  const uniqueCount = Math.floor(count * (1 - duplicateRatio));
  const products: ProductData[] = [];

  for (let i = 0; i < uniqueCount; i++) {
    products.push({
      platform: "taobao" as const,
      platformId: `product_${i}`,
      title: `Mock Product ${i}`,
      sourceUrl: `https://item.taobao.com/item.htm?id=${i}`,
      price: Math.random() * 1000,
      currency: "CNY",
      sales: Math.floor(Math.random() * 10000),
      salesPeriod: "month" as const,
      status: "active" as const,
      priority: "P1" as const,
      isTrending: false,
    });
  }

  while (products.length < count) {
    const randomIndex = Math.floor(Math.random() * uniqueCount);
    products.push({ ...products[randomIndex] });
  }

  return products;
}

describe("ValidateFilter Benchmark", () => {
  let filter: ValidateFilter;
  let context: Parameters<typeof filter.execute>[0];

  beforeAll(() => {
    filter = new ValidateFilter();
    context = {
      requestId: "bench",
      platform: "taobao",
      platformIds: [],
      options: {},
      startTime: Date.now(),
      metadata: {},
    };
  });

  bench("validate 100 products", async () => {
    const products = generateMockProducts(100);
    await filter.execute(context, { products });
  });

  bench("validate 1000 products", async () => {
    const products = generateMockProducts(1000);
    await filter.execute(context, { products });
  });

  bench("validate 10000 products", async () => {
    const products = generateMockProducts(10000);
    await filter.execute(context, { products });
  });

  bench("validate 1000 products with 10% invalid", async () => {
    const products = generateMockProductsPartialInvalid(1000, 0.1);
    await filter.execute(context, { products });
  });
});

describe("DedupeFilter Benchmark", () => {
  let filter: DedupeFilter;
  let context: Parameters<typeof filter.execute>[0];

  beforeAll(() => {
    filter = new DedupeFilter();
    context = {
      requestId: "bench",
      platform: "taobao",
      platformIds: [],
      options: {},
      startTime: Date.now(),
      metadata: {},
    };
  });

  bench("dedupe 100 unique products", async () => {
    const products = generateMockProducts(100);
    await filter.execute(context, { products });
  });

  bench("dedupe 1000 unique products", async () => {
    const products = generateMockProducts(1000);
    await filter.execute(context, { products });
  });

  bench("dedupe 10000 unique products", async () => {
    const products = generateMockProducts(10000);
    await filter.execute(context, { products });
  });

  bench("dedupe 1000 products with 30% duplicates", async () => {
    const products = generateMockProductsWithDuplicates(1000, 0.3);
    await filter.execute(context, { products });
  });

  bench("dedupe 10000 products with 50% duplicates", async () => {
    const products = generateMockProductsWithDuplicates(10000, 0.5);
    await filter.execute(context, { products });
  });
});

describe("FetchFilter Benchmark", () => {
  let filter: FetchFilter;
  let gateway: MockPlatformGateway;
  let context: Parameters<typeof filter.execute>[0];

  beforeAll(() => {
    gateway = new MockPlatformGateway("taobao");

    for (let i = 0; i < 10000; i++) {
      gateway.setMockProduct(`product_${i}`, {
        platform: "taobao",
        platformId: `product_${i}`,
        title: `Mock Product ${i}`,
        sourceUrl: `https://item.taobao.com/item.htm?id=${i}`,
        price: Math.random() * 1000,
        currency: "CNY",
        sales: Math.floor(Math.random() * 10000),
        salesPeriod: "month",
        status: "active",
        priority: "P1",
        isTrending: false,
      });
    }

    const gateways = new Map([["taobao", gateway as never]]);
    filter = new FetchFilter({ gateways, concurrency: 10 });

    context = {
      requestId: "bench",
      platform: "taobao",
      platformIds: [],
      options: {},
      startTime: Date.now(),
      metadata: {},
    };
  });

  bench("fetch 10 products (concurrency: 10)", async () => {
    const ids = Array.from({ length: 10 }, (_, i) => `product_${i}`);
    await filter.execute({ ...context, platformIds: ids }, { products: [] });
  });

  bench("fetch 100 products (concurrency: 10)", async () => {
    const ids = Array.from({ length: 100 }, (_, i) => `product_${i}`);
    await filter.execute({ ...context, platformIds: ids }, { products: [] });
  });

  bench("fetch 500 products (concurrency: 10)", async () => {
    const ids = Array.from({ length: 500 }, (_, i) => `product_${i}`);
    await filter.execute({ ...context, platformIds: ids }, { products: [] });
  });
});

describe("FetchFilter Concurrency Scaling", () => {
  const createFilterWithConcurrency = (concurrency: number) => {
    const gateway = new MockPlatformGateway("taobao");

    for (let i = 0; i < 1000; i++) {
      gateway.setMockProduct(`product_${i}`, {
        platform: "taobao",
        platformId: `product_${i}`,
        title: `Mock Product ${i}`,
        sourceUrl: `https://item.taobao.com/item.htm?id=${i}`,
        price: 100,
        currency: "CNY",
        sales: 1000,
        salesPeriod: "month",
        status: "active",
        priority: "P1",
        isTrending: false,
      });
    }

    const gateways = new Map([["taobao", gateway as never]]);
    return new FetchFilter({ gateways, concurrency });
  };

  bench("concurrency=1, fetch 100 products", async () => {
    const filter = createFilterWithConcurrency(1);
    const ids = Array.from({ length: 100 }, (_, i) => `product_${i}`);
    await filter.execute(
      {
        requestId: "bench",
        platform: "taobao",
        platformIds: ids,
        options: {},
        startTime: Date.now(),
        metadata: {},
      },
      { products: [] },
    );
  });

  bench("concurrency=5, fetch 100 products", async () => {
    const filter = createFilterWithConcurrency(5);
    const ids = Array.from({ length: 100 }, (_, i) => `product_${i}`);
    await filter.execute(
      {
        requestId: "bench",
        platform: "taobao",
        platformIds: ids,
        options: {},
        startTime: Date.now(),
        metadata: {},
      },
      { products: [] },
    );
  });

  bench("concurrency=10, fetch 100 products", async () => {
    const filter = createFilterWithConcurrency(10);
    const ids = Array.from({ length: 100 }, (_, i) => `product_${i}`);
    await filter.execute(
      {
        requestId: "bench",
        platform: "taobao",
        platformIds: ids,
        options: {},
        startTime: Date.now(),
        metadata: {},
      },
      { products: [] },
    );
  });

  bench("concurrency=20, fetch 100 products", async () => {
    const filter = createFilterWithConcurrency(20);
    const ids = Array.from({ length: 100 }, (_, i) => `product_${i}`);
    await filter.execute(
      {
        requestId: "bench",
        platform: "taobao",
        platformIds: ids,
        options: {},
        startTime: Date.now(),
        metadata: {},
      },
      { products: [] },
    );
  });

  bench("concurrency=50, fetch 100 products", async () => {
    const filter = createFilterWithConcurrency(50);
    const ids = Array.from({ length: 100 }, (_, i) => `product_${i}`);
    await filter.execute(
      {
        requestId: "bench",
        platform: "taobao",
        platformIds: ids,
        options: {},
        startTime: Date.now(),
        metadata: {},
      },
      { products: [] },
    );
  });
});

describe("StoreFilter Benchmark", () => {
  let filter: StoreFilter;
  let mockRepository: ProductRepository;
  let context: Parameters<typeof filter.execute>[0];

  beforeAll(() => {
    mockRepository = {
      create: async () => ({ id: 1 }) as never,
      createMany: async () => [],
      findById: async () => null,
      findByPlatformId: async () => null,
      findMany: async () => [],
      update: async () => null,
      updateMany: async () => [],
      upsert: async () => ({ id: 1 }) as never,
      delete: async () => true,
      deleteMany: async () => true,
      count: async () => 0,
      updatePrice: async () => null,
      updateSales: async () => null,
      markTrending: async () => null,
    };

    filter = new StoreFilter({ repository: mockRepository });

    context = {
      requestId: "bench",
      platform: "taobao",
      platformIds: [],
      options: {},
      startTime: Date.now(),
      metadata: {},
    };
  });

  bench("store 100 products", async () => {
    const products = generateMockProducts(100);
    await filter.execute(context, { products });
  });

  bench("store 500 products", async () => {
    const products = generateMockProducts(500);
    await filter.execute(context, { products });
  });

  bench("store 1000 products", async () => {
    const products = generateMockProducts(1000);
    await filter.execute(context, { products });
  });
});

describe("CacheFilter Benchmark", () => {
  let filter: CacheFilter;
  let mockCacheProvider: CacheProvider;
  let context: Parameters<typeof filter.execute>[0];

  beforeAll(() => {
    mockCacheProvider = {
      get: async () => null,
      getWithFallback: async () => null,
      set: async () => {},
      delete: async () => true,
      getMany: async () => ({}),
      setMany: async () => {},
      deleteMany: async () => 0,
      getJson: async () => null,
      setJson: async () => {},
      getProduct: async () => null,
      getProductWithFallback: async () => null,
      setProduct: async () => {},
      getPrice: async () => null,
      setPrice: async () => {},
      clear: async () => {},
      clearExpired: async () => 0,
      getStats: async () => ({
        entries: 0,
        maxEntries: 10000,
        hitRate: 0,
        hits: 0,
        misses: 0,
        expiredEntries: 0,
      }),
      getMetrics: () => ({ hits: 0, misses: 0, hitRate: 0, averageLatency: 0 }),
    };

    filter = new CacheFilter({ cacheProvider: mockCacheProvider });

    context = {
      requestId: "bench",
      platform: "taobao",
      platformIds: [],
      options: {},
      startTime: Date.now(),
      metadata: {},
    };
  });

  bench("cache 100 products", async () => {
    const products = generateMockProducts(100);
    await filter.execute(context, { products });
  });

  bench("cache 500 products", async () => {
    const products = generateMockProducts(500);
    await filter.execute(context, { products });
  });

  bench("cache 1000 products", async () => {
    const products = generateMockProducts(1000);
    await filter.execute(context, { products });
  });
});

describe("DataPipeline Full Pipeline Benchmark", () => {
  let pipeline: DataPipeline;
  let gateway: MockPlatformGateway;

  beforeAll(() => {
    gateway = new MockPlatformGateway("taobao");

    for (let i = 0; i < 1000; i++) {
      gateway.setMockProduct(`product_${i}`, {
        platform: "taobao",
        platformId: `product_${i}`,
        title: `Mock Product ${i}`,
        sourceUrl: `https://item.taobao.com/item.htm?id=${i}`,
        price: Math.random() * 1000,
        currency: "CNY",
        sales: Math.floor(Math.random() * 10000),
        salesPeriod: "month",
        status: "active",
        priority: "P1",
        isTrending: false,
      });
    }

    const mockRepository: ProductRepository = {
      create: async () => ({ id: 1 }) as never,
      createMany: async () => [],
      findById: async () => null,
      findByPlatformId: async () => null,
      findMany: async () => [],
      update: async () => null,
      updateMany: async () => [],
      upsert: async () => ({ id: 1 }) as never,
      delete: async () => true,
      deleteMany: async () => true,
      count: async () => 0,
      updatePrice: async () => null,
      updateSales: async () => null,
      markTrending: async () => null,
    };

    const mockCacheProvider: CacheProvider = {
      get: async () => null,
      getWithFallback: async () => null,
      set: async () => {},
      delete: async () => true,
      getMany: async () => ({}),
      setMany: async () => {},
      deleteMany: async () => 0,
      getJson: async () => null,
      setJson: async () => {},
      getProduct: async () => null,
      getProductWithFallback: async () => null,
      setProduct: async () => {},
      getPrice: async () => null,
      setPrice: async () => {},
      clear: async () => {},
      clearExpired: async () => 0,
      getStats: async () => ({
        entries: 0,
        maxEntries: 10000,
        hitRate: 0,
        hits: 0,
        misses: 0,
        expiredEntries: 0,
      }),
      getMetrics: () => ({ hits: 0, misses: 0, hitRate: 0, averageLatency: 0 }),
    };

    const gateways = new Map([["taobao", gateway as never]]);

    pipeline = new DataPipeline({
      gateways,
      repository: mockRepository,
      cacheProvider: mockCacheProvider,
    });
  });

  bench("full pipeline - 10 products", async () => {
    const ids = Array.from({ length: 10 }, (_, i) => `product_${i}`);
    await pipeline.execute("taobao", ids);
  });

  bench("full pipeline - 50 products", async () => {
    const ids = Array.from({ length: 50 }, (_, i) => `product_${i}`);
    await pipeline.execute("taobao", ids);
  });

  bench("full pipeline - 100 products", async () => {
    const ids = Array.from({ length: 100 }, (_, i) => `product_${i}`);
    await pipeline.execute("taobao", ids);
  });

  bench("full pipeline - 500 products", async () => {
    const ids = Array.from({ length: 500 }, (_, i) => `product_${i}`);
    await pipeline.execute("taobao", ids);
  });
});
