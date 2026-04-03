import { describe, it, expect } from "vitest";
import { runConcurrent, runInBatches } from "../../test/helpers/concurrency.js";
import { StressTest, PerformanceCollector } from "../../test/helpers/stress.js";

describe("Pipeline Stress Tests", () => {
  describe("ValidateFilter at Scale", () => {
    const validateProduct = (data: { id?: string; title?: string; price?: number }): boolean => {
      return !!(data.id && data.title && typeof data.price === "number" && data.price >= 0);
    };

    it("should validate 1000 products", async () => {
      const products = Array.from({ length: 1000 }, (_, i) => ({
        id: `product-${i}`,
        title: `Product ${i}`,
        price: Math.random() * 100,
      }));

      const results: boolean[] = [];

      const metrics = await StressTest.run({
        duration: 1000,
        rate: 500,
        fn: async () => {
          const product = products[Math.floor(Math.random() * products.length)];
          results.push(validateProduct(product));
        },
      });

      expect(metrics.totalRequests).toBeGreaterThan(0);
      expect(metrics.errorRate).toBe(0);
    });

    it("should handle invalid products efficiently", async () => {
      const products = Array.from({ length: 500 }, (_, i) => ({
        id: i % 10 === 0 ? undefined : `product-${i}`,
        title: i % 5 === 0 ? undefined : `Product ${i}`,
        price: i % 3 === 0 ? -1 : Math.random() * 100,
      }));

      const collector = new PerformanceCollector();
      collector.start();

      const result = await runConcurrent(async () => {
        const product = products[Math.floor(Math.random() * products.length)];
        const start = Date.now();
        const valid = validateProduct(product);
        collector.recordLatency(Date.now() - start, true);
        return valid;
      }, 500);

      expect(result.successCount).toBe(500);
    });
  });

  describe("DedupeFilter at Scale", () => {
    it("should deduplicate 1000 products", async () => {
      const seen = new Set<string>();
      const products = Array.from({ length: 1000 }, (_, i) => ({
        id: `product-${i % 100}`,
        title: `Product ${i}`,
      }));

      const dedupe = (product: { id: string }): boolean => {
        if (seen.has(product.id)) {
          return false;
        }
        seen.add(product.id);
        return true;
      };

      let uniqueCount = 0;

      const metrics = await StressTest.run({
        duration: 500,
        rate: 1000,
        fn: async () => {
          const product = products[Math.floor(Math.random() * products.length)];
          if (dedupe(product)) {
            uniqueCount++;
          }
        },
      });

      expect(metrics.errorRate).toBe(0);
      expect(uniqueCount).toBeGreaterThan(0);
    });

    it("should handle concurrent deduplication", async () => {
      const seen = new Map<string, number>();
      const products = Array.from({ length: 100 }, (_, i) => ({
        id: `product-${i}`,
      }));

      const result = await runConcurrent(async () => {
        const product = products[Math.floor(Math.random() * products.length)];
        const count = seen.get(product.id) ?? 0;
        seen.set(product.id, count + 1);
        return product.id;
      }, 500);

      expect(result.successCount).toBe(500);
      expect(seen.size).toBeGreaterThan(0);
      expect(seen.size).toBeLessThanOrEqual(100);
    });
  });

  describe("CacheFilter at Scale", () => {
    it("should handle cache operations at scale", async () => {
      const cache = new Map<string, { data: unknown; timestamp: number }>();
      const TTL = 1000;

      const getCached = (key: string): unknown | null => {
        const entry = cache.get(key);
        if (!entry) return null;
        if (Date.now() - entry.timestamp > TTL) {
          cache.delete(key);
          return null;
        }
        return entry.data;
      };

      const setCached = (key: string, data: unknown): void => {
        cache.set(key, { data, timestamp: Date.now() });
      };

      const keys = Array.from({ length: 100 }, (_, i) => `key-${i}`);

      const metrics = await StressTest.run({
        duration: 500,
        rate: 500,
        fn: async () => {
          const key = keys[Math.floor(Math.random() * keys.length)];
          const cached = getCached(key);
          if (!cached) {
            setCached(key, { value: Math.random() });
          }
        },
      });

      expect(metrics.errorRate).toBe(0);
      expect(metrics.throughput).toBeGreaterThan(100);
    });

    it("should handle cache invalidation under load", async () => {
      const cache = new Map<string, unknown>();
      let invalidations = 0;

      const result = await runConcurrent(async () => {
        const op = Math.random();
        if (op < 0.7) {
          cache.set(`key-${Math.floor(Math.random() * 10)}`, Math.random());
        } else if (op < 0.9) {
          cache.get(`key-${Math.floor(Math.random() * 10)}`);
        } else {
          cache.delete(`key-${Math.floor(Math.random() * 10)}`);
          invalidations++;
        }
        return true;
      }, 1000);

      expect(result.successCount).toBe(1000);
      expect(invalidations).toBeGreaterThan(0);
    });
  });

  describe("End-to-End Pipeline Stress", () => {
    interface Product {
      id: string;
      title: string;
      price: number;
      source: string;
    }

    const pipeline = {
      seen: new Set<string>(),
      cache: new Map<string, Product>(),

      validate(product: Partial<Product>): product is Product {
        return !!(product.id && product.title && typeof product.price === "number");
      },

      dedupe(product: Product): boolean {
        const key = `${product.source}:${product.id}`;
        if (this.seen.has(key)) return false;
        this.seen.add(key);
        return true;
      },

      cacheStore(product: Product): void {
        this.cache.set(`${product.source}:${product.id}`, product);
      },

      process(product: Partial<Product>): { success: boolean; stage?: string } {
        if (!this.validate(product)) {
          return { success: false, stage: "validate" };
        }
        if (!this.dedupe(product)) {
          return { success: false, stage: "dedupe" };
        }
        this.cacheStore(product);
        return { success: true };
      },
    };

    it("should process 5000 products through pipeline", async () => {
      const products = Array.from({ length: 5000 }, (_, i) => ({
        id: `product-${i % 500}`,
        title: `Product ${i}`,
        price: Math.random() * 100,
        source: `source-${i % 5}`,
      }));

      const metrics = await StressTest.run({
        duration: 2000,
        rate: 1000,
        fn: async () => {
          const product = products[Math.floor(Math.random() * products.length)];
          return pipeline.process(product);
        },
      });

      expect(metrics.totalRequests).toBeGreaterThan(1000);
      expect(metrics.throughput).toBeGreaterThan(100);
    });

    it("should handle mixed valid and invalid products", async () => {
      const products = Array.from({ length: 1000 }, (_, i) => ({
        id: i % 20 === 0 ? undefined : `product-${i}`,
        title: i % 15 === 0 ? undefined : `Product ${i}`,
        price: i % 10 === 0 ? undefined : Math.random() * 100,
        source: `source-${i % 3}`,
      }));

      let validCount = 0;
      let invalidCount = 0;

      const result = await runInBatches(
        async () => {
          const product = products[Math.floor(Math.random() * products.length)];
          const result = pipeline.process(product as Partial<Product>);
          if (result.success) {
            validCount++;
          } else {
            invalidCount++;
          }
          return result;
        },
        2000,
        100,
      );

      expect(result.successCount).toBe(2000);
      expect(validCount).toBeGreaterThan(0);
      expect(invalidCount).toBeGreaterThan(0);
    });
  });
});
